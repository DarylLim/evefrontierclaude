import { Router, Request, Response } from 'express';
import { SessionManager } from './SessionManager';

export function createRouter(sessionManager: SessionManager): Router {
  const router = Router();

  router.post('/session/init', async (req: Request, res: Response) => {
    const { walletAddress } = req.body as { walletAddress?: string };
    if (!walletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

    try {
      const sessionId = await sessionManager.create(walletAddress);
      res.json({ sessionId });
    } catch (err) {
      console.error('[routes] /session/init error:', err);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  router.post('/session/end', (req: Request, res: Response) => {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    sessionManager.destroy(sessionId);
    res.json({ ok: true });
  });

  return router;
}
