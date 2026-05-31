import { Brain, AlertTriangle, CheckCircle, X, Plus, Send, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';

type MemoryEvent = { id: string; type: 'blind-spot' | 'mastery' | 'attempt' | 'note'; text: string; time: string; };

function MemoryPanel() {
  const masteryScores = useWorkspaceStore(s => s.masteryScores);
  const blindSpots = useWorkspaceStore(s => s.blindSpots);
  const fetchMastery = useWorkspaceStore(s => s.fetchMastery);
  const fetchBlindSpots = useWorkspaceStore(s => s.fetchBlindSpots);

  const [localNotes, setLocalNotes] = useState<MemoryEvent[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchMastery();
    fetchBlindSpots();
  }, [fetchMastery, fetchBlindSpots]);

  // Build combined event list from backend data + local notes
  const events: MemoryEvent[] = [
    ...blindSpots.map(bs => ({
      id: `bs-${bs.conceptId}`,
      type: 'blind-spot' as const,
      text: `Struggling with "${bs.conceptId}" — ${bs.attemptCount} attempts across ${bs.sessionCount} sessions.`,
      time: bs.detectedAt ? new Date(bs.detectedAt).toLocaleDateString() : 'Recent',
    })),
    ...masteryScores.map(m => ({
      id: `mastery-${m.conceptId}`,
      type: 'mastery' as const,
      text: `${m.conceptId}: mastery score ${(m.masteryScore * 100).toFixed(0)}%${
        m.previousMastery !== m.masteryScore
          ? ` (${m.masteryScore > m.previousMastery ? '↑' : '↓'} from ${(m.previousMastery * 100).toFixed(0)}%)`
          : ''
      }`,
      time: m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : 'Recent',
    })),
    ...localNotes,
  ];

  const handleDismiss = (id: string) => {
    setLocalNotes(prev => prev.filter(e => e.id !== id));
  };

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    const newEvent: MemoryEvent = {
      id: `note-${Date.now()}`,
      type: 'note',
      text: noteInput.trim(),
      time: 'Just now',
    };
    setLocalNotes(prev => [newEvent, ...prev]);
    setNoteInput('');
    setShowAdd(false);
  };

  const handleRefresh = () => {
    fetchMastery();
    fetchBlindSpots();
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="text-ws-muted text-sm m-0">{events.length} learning events tracked</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            className="bg-transparent border border-ws-line rounded p-1 cursor-pointer text-ws-muted hover:text-ws-soft transition-colors"
            title="Refresh from backend"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            style={{
              background: 'none', border: '1px solid var(--ws-edge-soft)', borderRadius: "4px",
              padding: '3px 8px', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 'var(--ws-type-xs)',
            }}
          >
            <Plus size={10} /> Add Note
          </button>
        </div>
      </div>

      {showAdd && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            className="flex-1 bg-ws-surface border border-ws-line rounded px-3 py-2 text-ws-ink outline-none focus:border-ws-success transition-colors"
            style={{ flex: 1 }}
            placeholder="Add a study note..."
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
            autoFocus
          />
          <button
            type="button"
            className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-soft"
            onClick={handleAddNote}
            style={{ color: noteInput.trim() ? "var(--ws-accent)" : "var(--ws-muted)" }}
          >
            <Send size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto flex-1" style={{ paddingTop: 4 }}>
        {events.map(event => (
          <div key={event.id} className="flex gap-3 pb-4 relative">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-ws-surface border border-ws-line shrink-0 z-10 ${event.type}`}>
              {event.type === 'blind-spot' && <AlertTriangle size={12} />}
              {event.type === 'mastery' && <CheckCircle size={12} />}
              {event.type === 'attempt' && <Brain size={12} />}
              {event.type === 'note' && <Plus size={12} />}
            </div>
            <div className="flex flex-col gap-1 pt-[2px]" style={{ flex: 1 }}>
              <div className="text-ws-soft leading-[1.4]">{event.text}</div>
              <div className="text-ws-muted text-xs">{event.time}</div>
            </div>
            {event.type === 'note' && (
              <button
                type="button"
                onClick={() => handleDismiss(event.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: "var(--ws-muted)", opacity: 0.5, flexShrink: 0, alignSelf: 'flex-start',
                }}
                title="Dismiss"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div style={{ color: "var(--ws-muted)", fontSize: '11px', textAlign: 'center', padding: 'var(--ws-sp-6) 0' }}>
            No memory events yet. Practice some exercises to see mastery and blind spots here.
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryPanel;
