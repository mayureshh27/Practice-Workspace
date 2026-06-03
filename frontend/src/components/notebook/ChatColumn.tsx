import { Sparkles, Send, Plus, ArrowLeft } from 'lucide-react';
import { useRef, useEffect } from 'react';
import type { Domain, Subject, NavLocation } from '../../workspaceTypes';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

type Props = {
  domain: Domain;
  subject: Subject;
  sources: { id: string; selected: boolean }[];
  messages: Message[];
  isTyping: boolean;
  input: string;
  firstChapterId: string | undefined;
  onSend: () => void;
  onInputChange: (value: string) => void;
  onNavigate: (loc: NavLocation) => void;
  onAddChapter: () => void;
  onAddTopic: () => void;
};

export function ChatColumn({
  domain,
  subject,
  sources,
  messages,
  isTyping,
  input,
  firstChapterId,
  onSend,
  onInputChange,
  onNavigate,
  onAddChapter,
  onAddTopic,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const selectedCount = sources.filter((s) => s.selected).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-ws-bench border border-ws-edge-soft rounded-[12px] h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ws-edge-soft flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() =>
            onNavigate({ level: 'subject', domainId: domain.id, subjectId: subject.id })
          }
          className="press bg-transparent border-none text-ws-muted flex cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
          title="Back to subject"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-ws-ink m-0">{subject.name} Notebook</h2>
          <div className="text-[10px] text-ws-muted mt-px">{selectedCount} sources selected</div>
        </div>
        <button
          type="button"
          onClick={onAddChapter}
          className="press shrink-0 bg-transparent border border-ws-edge-soft text-ws-soft cursor-pointer px-2 py-1 rounded-ws-sm text-[10px] font-semibold flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
          title="Add chapter to this subject"
        >
          <Plus size={11} />
          Chapter
        </button>
        <button
          type="button"
          disabled={!firstChapterId}
          onClick={onAddTopic}
          className={`press shrink-0 bg-transparent border border-ws-edge-soft text-ws-soft cursor-pointer px-2 py-1 rounded-ws-sm text-[10px] font-semibold flex items-center gap-1 hover:bg-ws-surface-2 transition-colors ${
            !firstChapterId ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
          }`}
          title={
            firstChapterId ? `Add topic to ${subject.chapters[0].name}` : 'Create a chapter first'
          }
        >
          <Plus size={11} />
          Topic
        </button>
      </div>

      {/* Scrollable chat log */}
      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar">
        {/* Avatar header card */}
        <div className="flex flex-col items-center text-center bg-ws-bg border border-ws-edge-soft rounded-ws-lg p-6 mb-7">
          <div className="w-12 h-12 rounded-full bg-ws-surface-2 border border-ws-edge-soft flex items-center justify-center mb-3">
            <Sparkles size={22} className="text-ws-soft" />
          </div>
          <h1 className="text-lg font-extrabold text-ws-ink m-0 mb-1 tracking-tight">
            {subject.name} Admissions &amp; Study Roadmap
          </h1>
          <p className="text-xs text-ws-muted m-0">
            {sources.length} sources · Ingested context available for compilation
          </p>
          <div className="mt-3 px-3 py-1 bg-ws-surface-2 border border-ws-edge rounded-ws-md text-[10px] text-ws-soft">
            💡 Add a cover image and custom note to personalize your notebook!
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-ws-surface-2 border border-ws-edge flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-ws-glow" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-3 rounded-ws-md text-xs leading-[1.5] whitespace-pre-line ${
                  m.role === 'assistant'
                    ? 'bg-ws-bg border border-ws-edge-soft text-ws-ink'
                    : 'bg-ws-accent border-none text-ws-bg'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-ws-surface-2 border border-ws-edge flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-ws-glow animate-pulse" />
              </div>
              <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-md p-3 text-xs text-ws-muted italic">
                Synthesizing selected chunks...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-ws-edge-soft shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask a question or create something..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            className="flex-1 px-4 py-3 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
          />
          <div className="shrink-0 text-[10px] text-ws-muted select-none">
            {selectedCount} sources
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={!input.trim()}
            className={`press shrink-0 w-7 h-7 rounded-full border-none flex items-center justify-center transition-colors duration-100 ${
              input.trim()
                ? 'bg-ws-accent text-ws-bg cursor-pointer'
                : 'bg-ws-surface-2 text-ws-muted cursor-not-allowed'
            }`}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
