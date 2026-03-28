export function buildHealthResponse() {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  };
}
