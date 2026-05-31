import {X, Terminal, FlaskConical, Play, FileText, ScrollText, TestTubeDiagonal, Send, Power} from 'lucide-react';
import {useState, useRef, useEffect} from 'react';
import type {BottomDockTab} from '../workspaceTypes';

import { useUIStore } from '../stores/uiStore';

type Props = {
  outputContent?: string;
  verdictLabel?: string;
};

const TABS: {id: BottomDockTab; label: string; icon: typeof Terminal}[] = [
  {id: 'output',   label: 'Output',   icon: Play},
  {id: 'tests',    label: 'Tests',    icon: TestTubeDiagonal},
  {id: 'terminal', label: 'Terminal', icon: Terminal},
  {id: 'sandbox',  label: 'Sandbox',  icon: FlaskConical},
  {id: 'evals',    label: 'Evals',    icon: FileText},
  {id: 'logs',     label: 'Logs',     icon: ScrollText},
];

/* ── Test Results ────────────────────────── */
const TEST_RESULTS = [
  {id: 1, name: 'test_basic_input',     status: 'pass', time: '0.02s', detail: 'Expected: [1,2,3] → Got: [1,2,3]'},
  {id: 2, name: 'test_edge_case_empty', status: 'pass', time: '0.01s', detail: 'Expected: [] → Got: []'},
  {id: 3, name: 'test_large_input',     status: 'pass', time: '0.15s', detail: 'Expected: 1000 elements → Got: 1000 elements'},
  {id: 4, name: 'test_negative_values', status: 'fail', time: '0.03s', detail: 'Expected: [-1,-2,-3] → Got: [-1,-2,3]'},
  {id: 5, name: 'test_boundary',        status: 'pass', time: '0.01s', detail: 'Expected: [0] → Got: [0]'},
];

/* ── Eval Results ────────────────────────── */
const EVAL_RESULTS = [
  {id: 1, gate: 'Schema Validation',  status: 'pass', detail: 'Output matches PracticeArtifact JSON schema.'},
  {id: 2, gate: 'Sandbox Execution',  status: 'pass', detail: 'All generated code compiles and produces expected output.'},
  {id: 3, gate: 'Source Grounding',   status: 'warn', detail: 'Exercise 3 has no direct source chunk match.'},
  {id: 4, gate: 'Difficulty Calibration', status: 'pass', detail: 'Exercises correctly match requested difficulty level.'},
];

/* ── Log Entries ─────────────────────────── */
function generateLogs() {
  const now = new Date();
  return [
    {id: 1, time: new Date(now.getTime() - 120000).toLocaleTimeString(), level: 'INFO',  msg: 'Workspace session started'},
    {id: 2, time: new Date(now.getTime() - 90000).toLocaleTimeString(),  level: 'INFO',  msg: 'Loaded 14 source chunks from Modern Robotics V2'},
    {id: 3, time: new Date(now.getTime() - 60000).toLocaleTimeString(),  level: 'INFO',  msg: 'Context assembled: 4250 tokens across 3 slots'},
    {id: 4, time: new Date(now.getTime() - 45000).toLocaleTimeString(),  level: 'DEBUG', msg: 'Workflow create_exercises triggered with 2 sources'},
    {id: 5, time: new Date(now.getTime() - 30000).toLocaleTimeString(),  level: 'INFO',  msg: 'Workflow completed in 4.2s — 5 exercises generated'},
    {id: 6, time: new Date(now.getTime() - 15000).toLocaleTimeString(),  level: 'WARN',  msg: 'Source grounding check: exercise 3 ungrounded'},
    {id: 7, time: now.toLocaleTimeString(),                              level: 'INFO',  msg: 'Artifact "Kinematics Basics Quiz" approved'},
  ];
}

/* ── Terminal Commands ───────────────────── */
const TERMINAL_RESPONSES: Record<string, string> = {
  'help': 'Available commands: help, status, clear, sources, budget, whoami, ls',
  'status': 'Workspace: active\nProject: Robotics Learning\nSources loaded: 3\nArtifacts generated: 5\nBlind spots detected: 2',
  'sources': '1. Modern Robotics V2 (PDF, 14 chunks)\n2. Kinematics Lecture (Transcript, 8 chunks)\n3. Chapter 2 Notes (Note, 3 chunks)',
  'budget': 'Token budget: 4,250 / 8,000 (53%)\nSlots: system_prompt(850), source_chunks(2100), user_history(1300)',
  'whoami': 'Learner: Practice Workspace User\nProject: Robotics Learning\nSession: active since page load',
  'ls': 'artifacts/\n  kinematics_quiz.json\n  chapter2_flashcards.json\n  cspace_mindmap.json\nsources/\n  modern_robotics_v2.pdf\n  kinematics_lecture.txt\n  ch2_notes.md',
};

function TerminalTab() {
  const [history, setHistory] = useState<{type: 'cmd' | 'out'; text: string}[]>([
    {type: 'out', text: 'Practice Workspace Terminal v1.0\nType "help" for available commands.\n'},
  ]);
  const [cmd, setCmd] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const handleSubmit = () => {
    if (!cmd.trim()) return;
    const command = cmd.trim().toLowerCase();
    const response = command === 'clear'
      ? null
      : TERMINAL_RESPONSES[command] || `Command not found: ${cmd.trim()}\nType "help" for available commands.`;

    if (command === 'clear') {
      setHistory([{type: 'out', text: 'Terminal cleared.\n'}]);
    } else {
      setHistory(prev => [...prev, {type: 'cmd', text: cmd.trim()}, {type: 'out', text: response!}]);
    }
    setCmd('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[13px] leading-relaxed">
        {history.map((entry, i) => (
          <div key={i} className={`whitespace-pre-wrap ${entry.type === 'cmd' ? "text-ws-accent" : "text-ws-soft"}`}>
            {entry.type === 'cmd' ? `$ ${entry.text}` : entry.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center mt-2.5">
        <span className="text-ws-accent font-mono text-[13px]">$</span>
        <input
          type="text"
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="flex-1 bg-transparent border-none outline-none text-ws-ink font-mono text-[13px]"
          placeholder="Type a command..."
          autoFocus
        />
        <button type="button" onClick={handleSubmit} className="bg-transparent border-none cursor-pointer text-ws-accent flex">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function SandboxTab() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>(['Sandbox environment ready. Click "Start" to launch.']);

  const toggleSandbox = () => {
    if (running) {
      setRunning(false);
      setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Sandbox stopped.`]);
    } else {
      setRunning(true);
      setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Sandbox starting...`]);
      setTimeout(() => {
        setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Python 3.11 environment ready.`, `[${new Date().toLocaleTimeString()}] numpy, scipy, sympy loaded.`, `[${new Date().toLocaleTimeString()}] Sandbox running. Waiting for code execution...`]);
      }, 1200);
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSandbox}
          className={`flex items-center gap-1.5 px-2.5 h-8 rounded border text-[13px] font-semibold cursor-pointer transition-colors ${running ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20' : 'bg-ws-accent/10 border-ws-accent text-ws-accent hover:bg-ws-accent/20'}`}
        >
          <Power size={14} /> {running ? 'Stop' : 'Start'}
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-ws-muted">
          <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-ws-accent" : "bg-ws-muted"}`} />
          {running ? 'Running' : 'Stopped'}
        </span>
      </div>
      <div className="flex-1 overflow-auto font-mono text-[13px] text-ws-soft whitespace-pre-wrap leading-relaxed">
        {output.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function BottomDock({outputContent, verdictLabel}: Props) {
  const [logs] = useState(generateLogs);
  const open = useUIStore(s => s.bottomOpen);
  const activeTab = useUIStore(s => s.bottomTab);
  const onTabChange = useUIStore(s => s.setBottomTab);
  const onClose = () => useUIStore.getState().setBottomOpen(false);

  return (
    <div className={`flex flex-col bg-ws-bg border-t border-ws-line transition-[height] duration-200 ease-out overflow-hidden ${open ? 'h-[300px]' : 'h-0 border-t-0'}`}>
      <div className="flex items-center gap-1 px-2 border-b border-ws-line bg-ws-bg shrink-0 h-9 overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-ws-success bg-ws-surface-2/50' : 'text-ws-muted hover:bg-ws-surface-2 hover:text-ws-soft'}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}

        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 ml-auto text-ws-muted hover:text-red-500 hover:bg-ws-surface-2 rounded transition-colors shrink-0"
          onClick={onClose}
          title="Close dock"
          aria-label="Close dock"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-ws-bg">
        {activeTab === 'output' && (
          <div className="text-[13px] text-ws-soft font-mono whitespace-pre-wrap leading-relaxed">
            {verdictLabel && (
              <span className={`inline-block mb-2 px-2 py-0.5 text-[11px] font-bold border rounded ${verdictLabel === 'Accepted' ? "text-ws-accent border-ws-accent bg-ws-accent/10" : verdictLabel === 'Error' ? "text-red-500 border-red-500 bg-red-500/10" : "text-ws-soft border-ws-line bg-ws-surface-2"}`}>
                {verdictLabel}
              </span>
            )}
            <div>{outputContent || 'Run or submit code to see output here.'}</div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="text-[13px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ws-edge-soft text-ws-muted text-[11px] text-left">
                  <th className="px-2 py-1 font-semibold">Test</th>
                  <th className="px-2 py-1 font-semibold">Status</th>
                  <th className="px-2 py-1 font-semibold">Time</th>
                  <th className="px-2 py-1 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {TEST_RESULTS.map(t => (
                  <tr key={t.id} className="border-b border-ws-edge-soft">
                    <td className="px-2 py-1.5 text-ws-soft font-mono">{t.name}</td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase border ${t.status === 'pass' ? "text-ws-accent border-ws-accent/30 bg-ws-accent/10" : "text-red-500 border-red-500/30 bg-red-500/10"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-ws-muted font-mono">{t.time}</td>
                    <td className="px-2 py-1.5 text-ws-muted text-xs">{t.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-ws-muted text-[11px]">
              {TEST_RESULTS.filter(t => t.status === 'pass').length}/{TEST_RESULTS.length} tests passing
            </div>
          </div>
        )}

        {activeTab === 'terminal' && <TerminalTab />}
        {activeTab === 'sandbox' && <SandboxTab />}

        {activeTab === 'evals' && (
          <div className="text-[13px] flex flex-col gap-1.5">
            {EVAL_RESULTS.map(ev => (
              <div key={ev.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-ws-bg border border-ws-edge-soft rounded-md">
                <span className="flex-1 text-ws-soft">{ev.gate}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase border ${ev.status === 'pass' ? "text-ws-accent border-ws-accent/30 bg-ws-accent/10" : ev.status === 'warn' ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-red-500 border-red-500/30 bg-red-500/10"}`}>
                  {ev.status}
                </span>
                <span className="text-ws-muted text-[11px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {ev.detail}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="font-mono text-[11px] leading-loose text-ws-soft">
            {logs.map(log => (
              <div key={log.id} className="flex gap-2">
                <span className="text-ws-muted shrink-0">{log.time}</span>
                <span className={`shrink-0 font-bold w-10 ${log.level === 'WARN' ? "text-amber-500" : log.level === 'DEBUG' ? "text-ws-muted" : "text-ws-accent"}`}>
                  {log.level}
                </span>
                <span>{log.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomDock;
