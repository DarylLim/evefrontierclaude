import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { StateCollector } from '../collector/StateCollector';
import { ContextEngine } from '../engine/ContextEngine';
import { HeuristicEngine } from '../engine/HeuristicEngine';
import { AlertDispatcher } from '../dispatcher/AlertDispatcher';
import { LLMHandler } from '../llm/LLMHandler';
import { PlayerContext } from '../types';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

interface Session {
  sessionId: string;
  walletAddress: string;
  collector: StateCollector;
  dispatcher: AlertDispatcher | null;
  llm: LLMHandler;
  lastContext: PlayerContext | null;
  conversationHistory: ConversationMessage[];
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  async create(walletAddress: string): Promise<string> {
    const sessionId = randomUUID();
    const llm = new LLMHandler();

    const session: Session = {
      sessionId,
      walletAddress,
      collector: new StateCollector(walletAddress, (ctx) => this.handleContextUpdate(sessionId, ctx)),
      dispatcher: null,
      llm,
      lastContext: null,
      conversationHistory: [],
    };

    this.sessions.set(sessionId, session);
    await session.collector.start();
    return sessionId;
  }

  attachWebSocket(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(4004, 'Session not found');
      return;
    }

    const dispatcher = new AlertDispatcher(ws);
    session.dispatcher = dispatcher;

    // Replay last known state
    if (session.lastContext) {
      dispatcher.sendPlayerContext(session.lastContext);
      dispatcher.replayAlerts();
    }

    ws.on('message', (raw) => this.handleWSMessage(sessionId, raw.toString()));
    ws.on('close', () => {
      session.dispatcher = null;
    });
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.collector.stop();
      this.sessions.delete(sessionId);
    }
  }

  private handleContextUpdate(sessionId: string, ctx: PlayerContext): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const enriched = ContextEngine.transform(ctx);
    session.lastContext = enriched;

    const alerts = HeuristicEngine.evaluate(enriched);

    if (session.dispatcher) {
      session.dispatcher.sendPlayerContext(enriched);
      if (alerts.length > 0) {
        session.dispatcher.sendAlerts(alerts);
      }
    }
  }

  private async handleWSMessage(sessionId: string, raw: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.dispatcher) return;

    let parsed: { type: string; payload: unknown };
    try {
      parsed = JSON.parse(raw) as { type: string; payload: unknown };
    } catch {
      session.dispatcher.sendError('Invalid message format');
      return;
    }

    if (parsed.type === 'chat' && typeof parsed.payload === 'string') {
      const userMessage = parsed.payload;
      session.conversationHistory.push({ role: 'user', content: userMessage });

      const ctx = session.lastContext;
      if (!ctx) {
        session.dispatcher.sendError('Player context not yet available');
        return;
      }

      try {
        let fullResponse = '';
        await session.llm.streamResponse(
          userMessage,
          ctx,
          session.conversationHistory,
          (token) => {
            fullResponse += token;
            session.dispatcher?.sendLLMToken(token);
          },
          () => {
            session.conversationHistory.push({ role: 'assistant', content: fullResponse });
            session.dispatcher?.sendLLMDone();
          },
        );
      } catch (err) {
        console.error('[SessionManager] LLM error:', err);
        session.dispatcher.sendError('LLM request failed');
      }
    }
  }
}
