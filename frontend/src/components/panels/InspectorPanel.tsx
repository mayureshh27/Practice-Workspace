import {RefreshCw, ChevronDown, ChevronRight, Clock} from 'lucide-react';
import {useState} from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type EvalCheck = {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  latency: string;
  log: string;
};

type WorkflowRun = {
  id: string;
  template: string;
  latency: string;
  timestamp: string;
  checks: EvalCheck[];
};

const INITIAL_RUN: WorkflowRun = {
  id: 'wf_892b1a',
  template: 'create_exercises',
  latency: '4.2s',
  timestamp: new Date().toLocaleTimeString(),
  checks: [
    {id: 'e1', name: 'Schema Validation', status: 'pass', latency: '0.3s', log: '✓ Output matches PracticeArtifact schema\n✓ All required fields present\n✓ 5 exercises generated\n✓ difficulty field valid'},
    {id: 'e2', name: 'Sandbox Execution', status: 'pass', latency: '1.8s', log: '✓ Exercise 1: code compiles and runs\n✓ Exercise 2: code compiles and runs\n✓ Exercise 3: code compiles and runs\n✓ Exercise 4: expected output matches\n✓ Exercise 5: expected output matches'},
    {id: 'e3', name: 'Source Grounding', status: 'warn', latency: '2.1s', log: '✓ Exercise 1: grounded in chunk c1\n✓ Exercise 2: grounded in chunk c3\n⚠ Exercise 3: no direct source match found\n✓ Exercise 4: grounded in chunk c2\n✓ Exercise 5: grounded in chunk c1'},
  ],
};

const STATUS_COLOR: Record<EvalCheck['status'], string> = {
  pass: 'text-primary',
  warn: 'text-[#f59e0b]',
  fail: 'text-destructive',
};

function InspectorPanel() {
  const [run, setRun] = useState<WorkflowRun>(INITIAL_RUN);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const handleRerun = () => {
    setRerunning(true);
    setTimeout(() => {
      setRun(prev => ({
        ...prev,
        id: 'wf_' + Math.random().toString(36).slice(2, 8),
        timestamp: new Date().toLocaleTimeString(),
        latency: (3 + Math.random() * 3).toFixed(1) + 's',
        checks: prev.checks.map(c => ({
          ...c,
          latency: (Math.random() * 3).toFixed(1) + 's',
          status: Math.random() > 0.15 ? 'pass' : 'warn' as 'pass' | 'warn' | 'fail',
        })),
      }));
      setRerunning(false);
    }, 2000);
  };

  const statusBorderColor = (s: string) => s === 'pass' ? "hsl(var(--primary))" : s === 'warn' ? "#f59e0b" : "hsl(var(--destructive))";

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm m-0">Debug metadata and eval results.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRerun}
          disabled={rerunning}
          className={cn("h-7 text-xs", rerunning ? 'text-muted-foreground' : 'text-primary')}
        >
          <RefreshCw size={10} className={rerunning ? 'animate-spin' : ''} />
          {rerunning ? 'Running...' : 'Re-run Evals'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-md p-3 flex flex-col gap-2">
        <div className="text-foreground font-medium">Workflow Run</div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">ID</span>
          <span className="text-muted-foreground font-mono">{run.id}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">Template</span>
          <span className="text-muted-foreground">{run.template}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">Latency</span>
          <span className="text-muted-foreground">{run.latency}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">Ran at</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock size={10} /> {run.timestamp}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-md p-3 flex flex-col gap-2">
        <div className="text-foreground font-medium">Eval Checks</div>
        {run.checks.map(check => (
          <div key={check.id}>
            <button
              type="button"
              onClick={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
              className="flex items-center justify-between w-full py-1.5 bg-transparent border-0 border-b border-border cursor-pointer text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                {expandedCheck === check.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="text-[11px]">{check.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{check.latency}</span>
                <Badge variant={check.status === 'pass' ? 'default' : check.status === 'warn' ? 'secondary' : 'destructive'} className="text-[10px] font-bold uppercase tracking-wider">
                  {check.status}
                </Badge>
              </span>
            </button>
            {expandedCheck === check.id && (
              <pre
                className="my-1 mb-2 ml-[18px] p-2 bg-background border border-border rounded text-xs text-muted-foreground leading-[1.6] whitespace-pre-wrap font-mono"
                style={{ borderLeft: `2px solid ${statusBorderColor(check.status)}` }}
              >
                {check.log}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default InspectorPanel;
