import {useState} from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Slot = { id: string; name: string; tokens: number; enabled: boolean; };

const INITIAL_SLOTS: Slot[] = [
  {id: 'sys', name: 'system_prompt', tokens: 850, enabled: true},
  {id: 'src', name: 'source_chunks', tokens: 2100, enabled: true},
  {id: 'hist', name: 'user_history', tokens: 1300, enabled: true},
  {id: 'graph', name: 'concept_graph', tokens: 400, enabled: false},
  {id: 'mem', name: 'memory_events', tokens: 350, enabled: false},
];

const BUDGET_MAX = 8000;

function ContextPanel() {
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS);
  const [budgetMax, setBudgetMax] = useState(BUDGET_MAX);

  const usedTokens = slots.filter(s => s.enabled).reduce((sum, s) => sum + s.tokens, 0);
  const pct = Math.min(100, Math.round((usedTokens / budgetMax) * 100));
  const overBudget = usedTokens > budgetMax;

  const toggleSlot = (id: string) => {
    setSlots(prev => prev.map(s => s.id === id ? {...s, enabled: !s.enabled} : s));
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <p className="text-muted-foreground text-sm m-0">Context assembly and token usage.</p>

      <div className="bg-card border border-border rounded-md p-3 flex flex-col gap-2">
        <div className="text-foreground font-medium">Token Budget</div>
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <span className={cn("font-semibold", overBudget ? 'text-destructive' : 'text-primary')}>
            {usedTokens.toLocaleString()} / {budgetMax.toLocaleString()}
          </span>
          <span className={overBudget ? 'text-destructive' : 'text-muted-foreground'}>{pct}%</span>
        </div>
        <Progress
          value={pct}
          className="h-1.5 mt-1.5"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Label htmlFor="budget-slider" className="shrink-0">Max budget:</Label>
          <Slider
            id="budget-slider"
            min={2000}
            max={16000}
            step={500}
            value={[budgetMax]}
            onValueChange={([v]) => setBudgetMax(v)}
            className="flex-1"
          />
          <span className="min-w-[48px] text-right text-muted-foreground font-mono">{budgetMax.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-md p-3 flex flex-col gap-2">
        <div className="text-foreground font-medium">Context Slots</div>
        <div className="flex flex-col">
          {slots.map(slot => (
            <label
              key={slot.id}
              className="flex items-center gap-2 py-1.5 cursor-pointer border-b border-border last:border-0"
            >
              <Checkbox
                checked={slot.enabled}
                onCheckedChange={() => toggleSlot(slot.id)}
              />
              <span className={cn(
                "flex-1 text-[11px] font-mono",
                slot.enabled ? 'text-foreground' : 'text-muted-foreground line-through'
              )}>
                {slot.name}
              </span>
              <span className={cn(
                "text-xs font-mono",
                slot.enabled ? 'text-muted-foreground' : 'text-muted-foreground'
              )}>
                {slot.tokens}t
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ContextPanel;
