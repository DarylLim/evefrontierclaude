import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeChunk, PlayerContext } from '../types';
import { KnowledgeBase } from './KnowledgeBase';

const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? '1000', 10);
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `
You are GHOST — a survival officer AI companion for EVE Frontier.
Your job is to keep the player alive and informed.

Tone rules:
- Never condescending. Never sugarcoat the odds.
- Confident and direct. Wry when appropriate.
- Adapt to player stage: encouraging for new players, analytical for veterans.
- Post-death: matter-of-fact. Not harsh, not soft.

Output format rules:
- Respond in 1–3 short paragraphs. Plain language.
- No markdown headers or bullet lists in responses.
- Lead with the most important thing first.

Hard constraints:
- Never invent crafting recipes or game stats not found in the knowledge base.
- If you are unsure, say so. Do not guess on game mechanics.
- Never recommend actions that would cost the player real money.
`.trim();

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

const RATE_LIMIT_MS = 3000; // 1 request per 3 seconds per session
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

export class LLMHandler {
  private client: Anthropic;
  private lastRequestAt = 0;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async streamResponse(
    userMessage: string,
    playerContext: PlayerContext,
    conversationHistory: ConversationMessage[],
    onToken: (token: string) => void,
    onDone: () => void,
  ): Promise<void> {
    // Rate limiting
    const now = Date.now();
    if (now - this.lastRequestAt < RATE_LIMIT_MS) {
      onToken('Please wait a moment before sending another message.');
      onDone();
      return;
    }
    this.lastRequestAt = now;
    const chunks = KnowledgeBase.search(userMessage);
    const knowledgeSection = chunks.length > 0
      ? chunks.map((c: KnowledgeChunk, i: number) => `[SOURCE ${i + 1}: ${c.source}]\n${c.text}`).join('\n\n')
      : '[No relevant knowledge base entries found]';

    const userContent = `
[PLAYER STATE]
${JSON.stringify(playerContext, null, 2)}

[KNOWLEDGE CONTEXT]
${knowledgeSection}

[CONVERSATION HISTORY]
${conversationHistory.slice(-10).map((m) => `${m.role}: ${m.content}`).join('\n')}

[PLAYER MESSAGE]
${userMessage}
`.trim();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), REQUEST_TIMEOUT_MS),
    );

    const streamPromise = (async () => {
      const stream = await this.client.messages.stream({
        model: MODEL,
        max_tokens: LLM_MAX_TOKENS,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          onToken(event.delta.text);
        }
      }
    })();

    try {
      await Promise.race([streamPromise, timeoutPromise]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown LLM error';
      console.error('[LLMHandler] Error:', message);
      onToken(`\n\n[GHOST connection interrupted: ${message}]`);
    }

    onDone();
  }
}
