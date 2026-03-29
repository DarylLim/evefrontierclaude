import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { SessionManager } from './api/SessionManager';
import { createRouter } from './api/routes';
import { seedKnowledgeBase } from './llm/seedKnowledge';

seedKnowledgeBase();

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

const sessionManager = new SessionManager();
app.use('/api', createRouter(sessionManager));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(4000, 'sessionId query param required');
    return;
  }

  sessionManager.attachWebSocket(sessionId, ws);
  console.log(`[WS] Client connected: ${sessionId}`);
});

server.listen(PORT, () => {
  console.log(`[GHOST Backend] Listening on port ${PORT}`);
});
