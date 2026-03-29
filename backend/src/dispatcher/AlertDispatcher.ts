import { WebSocket } from 'ws';
import { AlertCard, PlayerContext, WSMessage } from '../types';

const MAX_ALERT_HISTORY = 20;

export class AlertDispatcher {
  private ws: WebSocket;
  private alertHistory: AlertCard[] = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  sendPlayerContext(ctx: PlayerContext): void {
    this.send({ type: 'player_context', payload: ctx });
  }

  sendAlerts(alerts: AlertCard[]): void {
    for (const alert of alerts) {
      this.alertHistory.push(alert);
      if (this.alertHistory.length > MAX_ALERT_HISTORY) {
        this.alertHistory.shift();
      }
      this.send({ type: 'alert', payload: alert });
    }
  }

  replayAlerts(): void {
    for (const alert of this.alertHistory) {
      this.send({ type: 'alert', payload: alert });
    }
  }

  sendLLMToken(token: string): void {
    this.send({ type: 'llm_token', payload: token });
  }

  sendLLMDone(): void {
    this.send({ type: 'llm_done', payload: null });
  }

  sendError(message: string): void {
    this.send({ type: 'error', payload: { message } });
  }

  private send(msg: WSMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
