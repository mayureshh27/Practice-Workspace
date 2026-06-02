import { Brain, AlertTriangle, CheckCircle, X, Plus, Send, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { masteryQueries } from '../../api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type MemoryEvent = { id: string; type: 'blind-spot' | 'mastery' | 'attempt' | 'note'; text: string; time: string; };

function MemoryPanel() {
  const queryClient = useQueryClient();
  const { data: masteryScores = [] } = useQuery(masteryQueries.scores());
  const { data: blindSpots = [] } = useQuery(masteryQueries.blindSpots());

  const [localNotes, setLocalNotes] = useState<MemoryEvent[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);

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
    queryClient.invalidateQueries({ queryKey: ['mastery'] });
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm m-0">{events.length} learning events tracked</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            title="Refresh from backend"
            className="size-7"
          >
            <RefreshCw size={12} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(!showAdd)}
            className="h-7 text-xs"
          >
            <Plus size={10} /> Add Note
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="flex gap-1.5">
          <Input
            type="text"
            placeholder="Add a study note..."
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
            autoFocus
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAddNote}
            disabled={!noteInput.trim()}
            className={cn("size-9", noteInput.trim() ? 'text-primary' : 'text-muted-foreground')}
            aria-label="Save note"
          >
            <Send size={14} />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pt-1">
        {events.map(event => (
          <div key={event.id} className="flex gap-3 pb-4 relative">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-card border border-border shrink-0 z-10">
              {event.type === 'blind-spot' && <AlertTriangle size={12} />}
              {event.type === 'mastery' && <CheckCircle size={12} />}
              {event.type === 'attempt' && <Brain size={12} />}
              {event.type === 'note' && <Plus size={12} />}
            </div>
            <div className="flex flex-col gap-1 pt-[2px] flex-1">
              <div className="text-muted-foreground leading-[1.4]">{event.text}</div>
              <div className="text-muted-foreground text-xs">{event.time}</div>
            </div>
            {event.type === 'note' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(event.id)}
                className="size-6 opacity-50 shrink-0 self-start"
                title="Dismiss"
              >
                <X size={12} />
              </Button>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-muted-foreground text-[11px] text-center py-6">
            No memory events yet. Practice some exercises to see mastery and blind spots here.
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryPanel;
