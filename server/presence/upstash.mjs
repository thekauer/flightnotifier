const UPSHASH_COMMAND_PATH = '/';
const UPSHASH_PIPELINE_PATH = '/pipeline';

function getUpstashConfig() {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    token,
  };
}

async function upstashFetch(path, body) {
  const { baseUrl, token } = getUpstashConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function runRedisCommand(command) {
  const payload = await upstashFetch(UPSHASH_COMMAND_PATH, command);
  if (payload.error) {
    throw new Error(String(payload.error));
  }

  return payload.result;
}

export async function runRedisPipeline(commands) {
  const payload = await upstashFetch(UPSHASH_PIPELINE_PATH, commands);
  return payload.map((entry) => {
    if (entry.error) {
      throw new Error(String(entry.error));
    }

    return entry.result;
  });
}
