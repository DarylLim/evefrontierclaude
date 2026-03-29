'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Message {
  id: string;
  role: 'user' | 'ghost' | 'alert';
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
          <p className="text-gray-500 text-sm text-center">Ask GHOST anything about EVE Frontier.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm ${
              msg.role === 'user'
                ? 'text-right'
                : msg.role === 'alert'
                ? 'border border-ghost-warning rounded p-2 text-ghost-warning'
                : 'text-ghost-accent'
            }`}
          >
            {msg.role === 'user' ? (
              <span className="bg-ghost-border rounded px-3 py-1 inline-block">{msg.content}</span>
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
          className="flex-1 bg-ghost-bg border border-ghost-border rounded px-3 py-2 text-sm focus:outline-none focus:border-ghost-accent"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 bg-ghost-accent text-ghost-bg rounded text-sm font-bold disabled:opacity-40 min-w-[44px]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
