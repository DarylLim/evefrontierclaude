'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Message {
  id: string;
  role: 'user' | 'ghost' | 'alert' | 'error';
  content: string;
  streaming?: boolean;
}

export default function ChatView({ sessionId }: { sessionId: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { sendMessage, lastMessage } = useWebSocket(sessionId);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage;

    if (msg.type === 'llm_token') {
      const token = msg.payload as string;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + token }];
        }
        return [...prev, { id: Date.now().toString(), role: 'ghost', content: token, streaming: true }];
      });
    } else if (msg.type === 'llm_done') {
      setIsStreaming(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, streaming: false }];
        }
        return prev;
      });
    } else if (msg.type === 'error') {
      const errorText = typeof msg.payload === 'string' ? msg.payload : (msg.payload as { message?: string })?.message ?? 'An error occurred';
      setIsStreaming(false);
      setMessages((prev) => {
        // If we were streaming, finalize that message first
        const updated = prev.length > 0 && prev[prev.length - 1]?.streaming
          ? [...prev.slice(0, -1), { ...prev[prev.length - 1], streaming: false }]
          : [...prev];
        return [...updated, { id: Date.now().toString(), role: 'error' as const, content: errorText }];
      });
    } else if (msg.type === 'alert') {
      const alert = msg.payload as { title: string; message: string; id: string };
      setMessages((prev) => [
        ...prev,
        { id: alert.id, role: 'alert', content: `${alert.title}: ${alert.message}` },
      ]);
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: trimmed }]);
    sendMessage({ type: 'chat', payload: trimmed });
    setInput('');
    setIsStreaming(true);
  };

  return (
    <div className="flex flex-col h-96 bg-ghost-surface rounded-lg border border-ghost-border">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-gray-500 text-sm">Ask GHOST anything about EVE Frontier.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['How do I refuel?', "What's my threat level?", 'Tutorial help'].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    // auto-send
                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: q }]);
                    sendMessage({ type: 'chat', payload: q });
                    setIsStreaming(true);
                  }}
                  className="text-xs px-3 py-2 rounded-full border border-ghost-accent text-ghost-accent hover:bg-ghost-accent/10 transition-colors min-h-[44px]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm ${
              msg.role === 'user'
                ? 'text-right'
                : msg.role === 'alert'
                ? 'border border-ghost-warning rounded p-2 text-ghost-warning'
                : msg.role === 'error'
                ? 'border border-ghost-danger rounded p-2 text-ghost-danger'
                : 'text-ghost-accent'
            }`}
          >
            {msg.role === 'user' ? (
              <span className="bg-ghost-border rounded px-3 py-1 inline-block">{msg.content}</span>
            ) : msg.role === 'error' ? (
              <span>
                <span className="font-bold mr-1">ERROR:</span>
                {msg.content}
              </span>
            ) : (
              <span>
                {msg.role === 'ghost' && <span className="text-gray-500 mr-1">GHOST:</span>}
                {msg.content}
                {msg.streaming && <span className="animate-pulse">▌</span>}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ghost-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask GHOST..."
          className="flex-1 bg-ghost-bg border border-ghost-border rounded px-3 py-2 text-sm focus:outline-none focus:border-ghost-accent min-h-[44px]"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 bg-ghost-accent text-ghost-bg rounded text-sm font-bold disabled:opacity-40 min-w-[44px] min-h-[44px]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
