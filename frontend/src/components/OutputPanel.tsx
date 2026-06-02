import { useState } from 'react';
import { Terminal, Copy, Check, Info } from 'lucide-react';
import type { OutputComparison } from '../types';
import MarkdownView from './MarkdownView';

type Props = {
  verdict: string;
  output: string;
  emptyMessage: string;
  comparison: OutputComparison | null;
};

function OutputPanel({ verdict, output, emptyMessage, comparison }: Props) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyStdout = () => {
    const textToCopy = output || emptyMessage;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isAccepted = verdict === 'Accepted' || verdict === 'Solved' || verdict === 'Pass';
  const isError = verdict === 'Error' || verdict === 'Fail' || verdict === 'Compile Error';

  return (
    <div className="flex flex-col h-[220px] flex-[0_0_220px] overflow-hidden relative bg-[#090c10] border-t border-ws-line">

      {/* Terminal Control Header Bar */}
      <div className="flex justify-between items-center bg-ws-surface border-b border-[#1f242c] px-4 h-[34px] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={12.5} className="text-ws-success" />
          <span className="text-[10px] font-mono font-bold text-ws-muted uppercase tracking-widest">
            Compile & Evaluation Terminal
          </span>

          {verdict && (
            <div
              className={`inline-flex items-center gap-1.25 px-2 py-0.5 rounded ml-2 text-[9.5px] font-extrabold uppercase tracking-wide border ${
                isAccepted
                  ? 'bg-ws-success/10 border-ws-success/20 text-ws-success'
                  : isError
                    ? 'bg-red-500/10 border-red-500/20 text-red-500'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}
            >
              <span
                className={`w-1.25 h-1.25 rounded-full inline-block ${
                  isAccepted ? 'bg-ws-success' : isError ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{
                  boxShadow: `0 0 6px ${
                    isAccepted
                      ? 'var(--color-ws-success)'
                      : isError
                        ? 'var(--color-red-500)'
                        : 'var(--color-amber-500)'
                  }`,
                }}
              />
              <span>{verdict}</span>
            </div>
          )}
        </div>

        {/* Console Action Bar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyStdout}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-ws-surface-2 border border-[#30363d] text-[10.5px] font-semibold text-ws-muted cursor-pointer transition-all duration-120 hover:bg-[#21262d] hover:border-[#8b949e]"
            title="Copy logs"
          >
            {isCopied ? <Check size={11} className="text-ws-success" /> : <Copy size={11} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Terminal View Body scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar">
        {comparison && (
          <div className="flex flex-col bg-ws-surface border border-[#21262d] rounded-md overflow-hidden">
            <div className="flex justify-between items-center px-3 py-1.5 bg-ws-surface-2 border-b border-[#21262d]">
              <b className="text-[11px] font-bold text-ws-muted font-mono">
                {comparison.title}
              </b>
              <span
                className={`text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${comparison.status === 'match' ? 'bg-ws-success/10 text-ws-success border-ws-success/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
              >
                {comparison.status === 'match' ? 'Matches Expected' : 'Difference Found'}
              </span>
            </div>

            <div className="grid grid-cols-2">
              <div className="flex flex-col gap-1 p-2.5 border-r border-[#21262d]">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide font-mono">
                  Expected Standard Output
                </span>
                <pre className="m-0 text-[10.5px] font-mono text-[#71d99f] whitespace-pre-wrap bg-ws-success/5 px-2 py-1.5 rounded border border-ws-success/10">
                  {comparison.expected}
                </pre>
              </div>

              <div className="flex flex-col gap-1 p-2.5">
                <span className="text-[9px] font-bold text-red-600 uppercase tracking-wide font-mono">
                  Actual Program Output
                </span>
                <pre className="m-0 text-[10.5px] font-mono text-[#ff8a80] whitespace-pre-wrap bg-red-500/5 px-2 py-1.5 rounded border border-red-500/10">
                  {comparison.actual}
                </pre>
              </div>
            </div>

            {comparison.diff && (
              <div className="flex flex-col gap-0.5 bg-ws-surface-2 border-t border-[#21262d] px-3 py-2 text-[10.5px] font-mono text-ws-muted">
                <div className="font-extrabold text-ws-ink flex items-center gap-1.5 mb-0.5">
                  <Info size={11} className="text-ws-success" />
                  <span>First differing segment located at line {comparison.diff.line}</span>
                </div>
                <div className="flex gap-1 bg-ws-success/5 px-1.5 py-0.5 rounded border-l-[3px] border-emerald-600">
                  <span className="text-ws-success font-extrabold w-3.5">-</span>
                  <span className="text-[#71d99f]">Expected: {comparison.diff.expected}</span>
                </div>
                <div className="flex gap-1 bg-red-500/5 px-1.5 py-0.5 rounded border-l-[3px] border-red-600">
                  <span className="text-red-500 font-extrabold w-3.5">+</span>
                  <span className="text-[#ff8a80]">Actual:   {comparison.diff.actual}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[#c9d1d9] text-[11.5px] font-mono leading-[1.6]">
          <MarkdownView text={output || emptyMessage} className="output-markdown" />
        </div>
      </div>

    </div>
  );
}

export default OutputPanel;
