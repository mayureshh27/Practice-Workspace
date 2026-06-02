import { Send, Sparkles, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore, type ChatMessage } from '../../stores/workspaceStore';

function TutorPanel() {
  const chatMessages = useWorkspaceStore(s => s.chatMessages);
  const isChatLoading = useWorkspaceStore(s => s.isChatLoading);
  const sendChatMessage = useWorkspaceStore(s => s.sendChatMessage);
  const chatSessionId = useWorkspaceStore(s => s.chatSessionId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isChatLoading]);

  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return;

    const text = input.trim();
    setInput('');
    await sendChatMessage(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Empty state */}
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <Sparkles size={24} className="text-ws-success opacity-60" />
            <p className="text-ws-muted text-sm leading-relaxed">
              Ask a question about the topic you're studying.
              <br />
              The Socratic tutor will guide you with hints, never answers.
            </p>
            {!chatSessionId && (
              <p className="text-ws-muted text-xs opacity-60">
                A chat session will be created automatically.
              </p>
            )}
          </div>
        )}

        {/* Messages */}
        {chatMessages.map((m: ChatMessage) => (
          <div
            key={m.id}
            className={`flex flex-col gap-1 max-w-[90%] ${
              m.role === 'user' ? 'self-end' : 'self-start'
            }`}
          >
            {m.role === 'assistant' && (
              <Sparkles size={12} className="text-ws-success mb-[2px]" />
            )}
            {m.role === 'system' && (
              <AlertTriangle size={12} className="text-amber-400 mb-[2px]" />
            )}
            <div
              className={`px-3 py-2 rounded-lg leading-[1.4] ${
                m.role === 'user'
                  ? 'bg-ws-glow/10 border border-ws-glow/30 text-ws-ink'
                  : m.role === 'system'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-ws-ink'
                    : 'bg-ws-surface border border-ws-line text-ws-ink'
              }`}
            >
              {m.content}
            </div>
            <span className="text-[10px] text-ws-muted px-1">
              {new Date(m.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}

        {/* Loading indicator */}
        {isChatLoading && (
          <div className="flex flex-col gap-1 max-w-[90%] self-start">
            <Sparkles size={12} className="text-ws-success mb-[2px]" />
            <div className="px-3 py-2 rounded-lg bg-ws-surface border border-ws-line leading-[1.4]">
              <span className="text-ws-muted italic flex items-center gap-2">
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-ws-success animate-pulse"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </span>
                Thinking...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-ws-line flex gap-2 items-center bg-ws-bg">
        <input
          type="text"
          className="flex-1 bg-ws-surface border border-ws-line rounded px-3 py-2 text-ws-ink outline-none focus:border-ws-success transition-colors"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isChatLoading}
        />
        <button
          type="button"
          className={`bg-transparent border-none cursor-pointer p-1 rounded hover:text-ws-soft ${
            input.trim() && !isChatLoading ? 'text-ws-glow' : 'text-ws-muted'
          }`}
          onClick={handleSend}
          disabled={isChatLoading || !input.trim()}
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

export default TutorPanel;
