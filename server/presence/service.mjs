import {
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  PRESENCE_KEYS,
  PRESENCE_SESSION_TTL_MS,
  normalizeAirportIdent,
} from './constants.mjs';
import { runRedisCommand, runRedisPipeline } from './upstash.mjs';

const TOUCH_SESSION_SCRIPT = `
local previousAirport = redis.call('GET', KEYS[1])
local nextAirport = ARGV[3]

if nextAirport == '' then
  nextAirport = false
end

if previousAirport == false then
  redis.call('INCR', KEYS[3])
end

if previousAirport ~= false and previousAirport ~= '' and previousAirport ~= nextAirport then
  local previousCountKey = ARGV[4] .. previousAirport .. ':count'
  local previousCount = redis.call('DECR', previousCountKey)
  if previousCount <= 0 then
    redis.call('DEL', previousCountKey)
    redis.call('SREM', KEYS[4], previousAirport)
  end
end

if nextAirport ~= false and previousAirport ~= nextAirport then
  local nextCountKey = ARGV[4] .. nextAirport .. ':count'
  redis.call('INCR', nextCountKey)
  redis.call('SADD', KEYS[4], nextAirport)
end

redis.call('SET', KEYS[1], nextAirport or '')
redis.call('ZADD', KEYS[2], tonumber(ARGV[2]), ARGV[1])

local totalUsers = tonumber(redis.call('GET', KEYS[3]) or '0')
local airportUsers = 0

if nextAirport ~= false then
  airportUsers = tonumber(redis.call('GET', ARGV[4] .. nextAirport .. ':count') or '0')
end

return { tostring(totalUsers), nextAirport or '', tostring(airportUsers) }
`;

const REMOVE_SESSION_SCRIPT = `
local previousAirport = redis.call('GET', KEYS[1])

if previousAirport == false then
  redis.call('ZREM', KEYS[2], ARGV[1])
  return { '0', '', '0' }
end

redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[1])

if previousAirport ~= '' then
  local previousCountKey = ARGV[2] .. previousAirport .. ':count'
  local previousCount = redis.call('DECR', previousCountKey)
  if previousCount <= 0 then
    redis.call('DEL', previousCountKey)
    redis.call('SREM', KEYS[3], previousAirport)
    previousCount = 0
  end
end

local totalUsers = redis.call('DECR', KEYS[4])
if totalUsers < 0 then
  redis.call('SET', KEYS[4], 0)
  totalUsers = 0
end

local airportUsers = 0
if previousAirport ~= '' then
  airportUsers = tonumber(redis.call('GET', ARGV[2] .. previousAirport .. ':count') or '0')
end

return { tostring(totalUsers), previousAirport, tostring(airportUsers) }
`;

const REAP_EXPIRED_SESSIONS_SCRIPT = `
local expiredSessionIds = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local removed = 0

for _, sessionId in ipairs(expiredSessionIds) do
  local sessionKey = ARGV[2] .. sessionId
  local airport = redis.call('GET', sessionKey)

  redis.call('DEL', sessionKey)
  redis.call('ZREM', KEYS[1], sessionId)

  if airport ~= false then
    removed = removed + 1
    local totalUsers = redis.call('DECR', KEYS[2])
    if totalUsers < 0 then
      redis.call('SET', KEYS[2], 0)
    end

    if airport ~= '' then
      local airportCountKey = ARGV[3] .. airport .. ':count'
      local airportUsers = redis.call('DECR', airportCountKey)
      if airportUsers <= 0 then
        redis.call('DEL', airportCountKey)
        redis.call('SREM', KEYS[3], airport)
      end
    end
  end
end

return tostring(removed)
`;

function getSessionKey(sessionId) {
  return `${PRESENCE_KEYS.sessionPrefix}${sessionId}`;
}

async function reapExpiredSessions() {
  await runRedisCommand([
    'EVAL',
    REAP_EXPIRED_SESSIONS_SCRIPT,
    '3',
    PRESENCE_KEYS.expiries,
    PRESENCE_KEYS.totalUsers,
    PRESENCE_KEYS.airports,
    String(Date.now()),
    PRESENCE_KEYS.sessionPrefix,
    PRESENCE_KEYS.airportCountPrefix,
  ]);
}

export async function touchPresenceSession(sessionId, airportIdent) {
  const normalizedAirportIdent = normalizeAirportIdent(airportIdent);

  await reapExpiredSessions();

  const result = await runRedisCommand([
    'EVAL',
    TOUCH_SESSION_SCRIPT,
    '4',
    getSessionKey(sessionId),
    PRESENCE_KEYS.expiries,
    PRESENCE_KEYS.totalUsers,
    PRESENCE_KEYS.airports,
    sessionId,
    String(Date.now() + PRESENCE_SESSION_TTL_MS),
    normalizedAirportIdent ?? '',
    PRESENCE_KEYS.airportCountPrefix,
  ]);

  return {
    totalUsers: Number(result?.[0] ?? 0),
    airportIdent: result?.[1] || normalizedAirportIdent,
    airportUsers: Number(result?.[2] ?? 0),
  };
}

export async function removePresenceSession(sessionId) {
  await reapExpiredSessions();

  const result = await runRedisCommand([
    'EVAL',
    REMOVE_SESSION_SCRIPT,
    '4',
    getSessionKey(sessionId),
    PRESENCE_KEYS.expiries,
    PRESENCE_KEYS.airports,
    PRESENCE_KEYS.totalUsers,
    sessionId,
    PRESENCE_KEYS.airportCountPrefix,
  ]);

  return {
    totalUsers: Number(result?.[0] ?? 0),
    airportIdent: result?.[1] || null,
    airportUsers: Number(result?.[2] ?? 0),
  };
}

export async function getPresenceSnapshot() {
  await reapExpiredSessions();

  const airports = await runRedisCommand(['SMEMBERS', PRESENCE_KEYS.airports]);
  const normalizedAirports = Array.isArray(airports)
    ? airports.filter((airport) => typeof airport === 'string' && airport.length > 0).sort()
    : [];

  const commands = [
    ['GET', PRESENCE_KEYS.totalUsers],
    ...normalizedAirports.map((airport) => ['GET', `${PRESENCE_KEYS.airportCountPrefix}${airport}:count`]),
  ];
  const [totalUsersRaw, ...airportCountsRaw] = await runRedisPipeline(commands);

  return {
    totalUsers: Number(totalUsersRaw ?? 0),
    airports: normalizedAirports.map((airport, index) => ({
      airportIdent: airport,
      users: Number(airportCountsRaw[index] ?? 0),
    })),
  };
}

export function getPresenceWelcomeMessage(sessionId) {
  return {
    type: 'welcome',
    sessionId,
    heartbeatIntervalMs: PRESENCE_HEARTBEAT_INTERVAL_MS,
    sessionTtlMs: PRESENCE_SESSION_TTL_MS,
  };
}
