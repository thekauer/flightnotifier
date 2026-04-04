export const PRESENCE_HEARTBEAT_INTERVAL_MS = 20_000;
export const PRESENCE_SESSION_TTL_MS = 45_000;

export const PRESENCE_KEYS = {
  expiries: 'presence:sessions:expiries',
  totalUsers: 'presence:users:count',
  airports: 'presence:airports',
  sessionPrefix: 'presence:session:',
  airportCountPrefix: 'presence:airport:',
};

export function normalizeAirportIdent(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}
