import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { FR24Poller } from './fr24/poller.js';
import { FlightStateManager, type StateChangeEvent } from './state.js';
import { buildSchedule } from './fr24/schedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// ── Approach bounding box (wider Amsterdam area) ─────────────────────
const APPROACH_BOUNDS = { north: 52.45, south: 52.2, west: 4.6, east: 5.1 };

// ── Flight state manager + poller ────────────────────────────────────
const stateManager = new FlightStateManager();
const poller = new FR24Poller(APPROACH_BOUNDS, (flights) => stateManager.update(flights));

// ── SSE clients ──────────────────────────────────────────────────────
type SSEClient = {
  id: number;
  res: express.Response;
};

let clientIdCounter = 0;
const sseClients: SSEClient[] = [];

function broadcastSSE(event: StateChangeEvent): void {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.res.write(`data: ${data}\n\n`);
  }
}

stateManager.onEvent(broadcastSSE);

// ── Routes ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/state', (_req, res) => {
  res.json(stateManager.getState());
});

app.get('/api/schedule', (_req, res) => {
  const state = stateManager.getState();
  const approachingIds = new Set(state.approachingFlights.map((f) => f.flightId));
  res.json(buildSchedule(state.allFlights, approachingIds));
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  const currentState = stateManager.getState();
  const initEvent: StateChangeEvent = { type: 'flights_updated', state: currentState };
  res.write(`data: ${JSON.stringify(initEvent)}\n\n`);

  const clientId = clientIdCounter++;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);
  console.log(`[SSE] Client ${clientId} connected (total: ${sseClients.length})`);

  req.on('close', () => {
    const index = sseClients.findIndex((c) => c.id === clientId);
    if (index !== -1) sseClients.splice(index, 1);
    console.log(`[SSE] Client ${clientId} disconnected (total: ${sseClients.length})`);
  });
});

// ── Static files (production) ────────────────────────────────────────
const clientDist = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  poller.start();
});
