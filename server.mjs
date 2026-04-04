import http from 'node:http';
import next from 'next';
import { WebSocketServer } from 'ws';
import {
  getPresenceSnapshot,
  getPresenceWelcomeMessage,
  removePresenceSession,
  touchPresenceSession,
} from './server/presence/service.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });

function sendJson(ws, payload) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(JSON.stringify(payload));
}

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const handleUpgrade = app.getUpgradeHandler();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/presence/stats') {
      try {
        const snapshot = await getPresenceSnapshot();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(snapshot));
      } catch (error) {
        console.error('[presence] Failed to fetch snapshot:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to load presence snapshot.' }));
      }
      return;
    }

    handle(req, res);
  });
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    const sessionId = crypto.randomUUID();
    let closed = false;

    sendJson(ws, getPresenceWelcomeMessage(sessionId));

    ws.on('message', async (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage.toString());

        if (parsed?.type !== 'heartbeat') {
          sendJson(ws, { type: 'error', message: 'Unsupported presence message type.' });
          return;
        }

        const snapshot = await touchPresenceSession(sessionId, parsed.airportIdent ?? null);

        sendJson(ws, {
          type: 'presence',
          sessionId,
          airportIdent: snapshot.airportIdent,
          totalUsers: snapshot.totalUsers,
          airportUsers: snapshot.airportUsers,
        });
      } catch (error) {
        console.error('[presence] Failed to process message:', error);
        sendJson(ws, { type: 'error', message: 'Failed to update presence.' });
      }
    });

    ws.on('close', async () => {
      if (closed) {
        return;
      }

      closed = true;

      try {
        await removePresenceSession(sessionId);
      } catch (error) {
        console.error('[presence] Failed to remove session:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('[presence] Socket error:', error);
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname !== '/api/presence') {
      handleUpgrade(req, socket, head);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  console.error('Failed to start Next server:', error);
  process.exit(1);
});
