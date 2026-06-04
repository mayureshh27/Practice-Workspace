import { X, Upload, Globe, Cloud, Clipboard, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { CustomSelect } from '../ui/CustomSelect';
import { INGEST_TABS, type IngestTab, type IngestFilter } from './ingestTabs';
import { useIngestMutation } from '../../api/mutations';

// Inline GitHub icon to avoid external dep
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="12"
    height="12"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const TAB_ICONS: Record<IngestTab, React.FC<{ size?: number; className?: string }>> = {
  upload: (p) => <Upload {...p} />,
  github: (p) => <GithubIcon className={p.className} />,
  web: (p) => <Globe {...p} />,
  drive: (p) => <Cloud {...p} />,
  text: (p) => <Clipboard {...p} />,
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Passed down so Phase 10 mutation can target the right subject. */
  domainId: string;
  subjectId: string;
  /** How many sources are already loaded — used for the capacity bar. */
  sourceCount: number;
};

/**
 * IngestionModal — renders the 5-tab source ingest form.
 *
 * Phase 9: The form is fully UI-functional. The submit handlers are stubs
 * that will be wired to the real `POST /api/sources/ingest` mutation in
 * Phase 10 (`useIngestMutation`). No `setTimeout` calls exist.
 */
export function IngestionModal({ open, onClose, domainId, subjectId, sourceCount }: Props) {
  const [activeTab, setActiveTab] = useState<IngestTab>('upload');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestText, setIngestText] = useState('');
  const [ingestName, setIngestName] = useState('');
  const [ingestFilter, setIngestFilter] = useState<IngestFilter>('web');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ingestMutation = useIngestMutation(() => {
    handleClose();
  });

  if (!open) return null;

  const resetForm = () => {
    setIngestUrl('');
    setIngestText('');
    setIngestName('');
    setIngestFilter('web');
    setActiveTab('upload');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ── Phase 10: Wired to real POST /api/sources/ingest ──────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      ingestMutation.mutate({
        domainId,
        subjectId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        content: b64.split(',')[1],
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (activeTab === 'text') {
      ingestMutation.mutate({
        domainId,
        subjectId,
        fileName: ingestName || 'Pasted Text.txt',
        mimeType: 'text/plain',
        content: btoa(unescape(encodeURIComponent(ingestText))),
      });
    } else if (activeTab === 'github' || activeTab === 'web') {
      ingestMutation.mutate({
        domainId,
        subjectId,
        fileName: ingestUrl,
        mimeType: activeTab === 'github' ? 'application/vnd.github' : 'text/html',
      });
    }
  };

  const handleDriveConnect = () => {
    ingestMutation.mutate({
      domainId,
      subjectId,
      fileName: 'Google Drive Import',
      mimeType: 'application/vnd.google.drive',
    });
  };

  // ── /Phase 10 stubs ──────────────────────────────────────────────────────

  const showSubmitButton = activeTab !== 'upload' && activeTab !== 'drive';
  const submitDisabled = (!ingestUrl.trim() && !ingestText.trim()) || ingestMutation.isPending;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center fade-in"
      onClick={handleClose}
    >
      <div
        className="scale-in bg-ws-bg border border-ws-edge rounded-2xl w-full max-w-[560px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] overflow-hidden text-ws-ink flex flex-col m-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-ws-edge-soft flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ws-ink m-0 mb-1">Add sources to Subject</h2>
            <p className="text-[11px] text-ws-muted m-0">
              Ingest PDFs, websites, GitHub repositories, or copied text directly to subject
              context.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="press bg-transparent border-none text-ws-muted cursor-pointer flex p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5 flex-wrap">
            {INGEST_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIngestUrl('');
                    setIngestText('');
                    setIngestName('');
                  }}
                  className={`press flex items-center gap-1.5 px-3 py-2 border rounded-ws-lg text-[11px] font-semibold cursor-pointer transition-all duration-[120ms] ease-emil-out ${
                    activeTab === tab.id
                      ? 'bg-ws-accent/10 border-ws-accent text-ws-accent'
                      : 'bg-ws-bg border-ws-line text-ws-soft h-bd-muted'
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels */}
        <div className="px-6 pt-4 pb-3 flex flex-col gap-3">
          {activeTab === 'upload' && (
            <div
              className="press border-2 border-dashed border-ws-edge rounded-[12px] px-4 py-8 text-center bg-ws-bg flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors duration-150 h-bd-accent"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} className="text-ws-accent" />
              <div>
                <div className="text-xs font-bold text-ws-ink">or drop your files here</div>
                <div className="text-[10px] text-ws-muted mt-1">
                  PDF, MD, Markdown, or TXT up to 10MB
                </div>
              </div>
              <button
                type="button"
                className="press px-3.5 py-1.5 bg-ws-accent text-ws-bg border-none rounded-ws-md text-[11px] font-bold cursor-pointer flex items-center gap-2"
                disabled={ingestMutation.isPending}
              >
                {ingestMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Upload files
              </button>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={ingestMutation.isPending}
                accept=".pdf,.md,.txt,.markdown"
              />
            </div>
          )}

          {activeTab === 'github' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  placeholder="e.g., https://github.com/username/project"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
                />
              </div>
              <div className="text-[10px] text-ws-muted leading-[1.45]">
                💡 We will parse the repository structure, ingest markdown files (README, docs,
                architecture guides), and build conceptual references directly inside the notebook.
              </div>
            </div>
          )}

          {activeTab === 'web' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-ws-bg border border-ws-edge rounded-ws-lg">
                <Globe size={13} className="text-ws-muted" />
                <CustomSelect
                  value={ingestFilter}
                  onChange={(val) => setIngestFilter(val as IngestFilter)}
                  options={[
                    { value: 'web', label: 'Web' },
                    { value: 'github', label: 'GitHub' },
                  ]}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--ws-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <span className="w-px h-3.5 bg-ws-surface-2 self-stretch" />
                <input
                  type="text"
                  placeholder="Search the web for new sources or paste URL..."
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  className="flex-1 bg-transparent border-none text-ws-ink text-xs outline-none"
                />
              </div>
              <div className="text-[10px] text-ws-muted leading-[1.45]">
                💡 Enter a search query to research concepts via web search summaries, or paste any
                direct URL page to ingest its full textbook text content.
              </div>
            </div>
          )}

          {activeTab === 'drive' && (
            <div className="flex flex-col gap-3 items-center py-5">
              <div className="w-11 h-11 rounded-full bg-ws-surface-2 flex items-center justify-center text-ws-accent mb-2">
                <Cloud size={20} />
              </div>
              <div className="text-[13px] font-bold text-ws-ink text-center">
                Google Drive Integration
              </div>
              <p className="text-[11px] text-ws-muted text-center max-w-[360px] m-0 mb-3 leading-[1.45]">
                Seamlessly connect your Google Drive account to import study guides, slide decks,
                papers, or homework sheets.
              </p>
              <button
                type="button"
                onClick={handleDriveConnect}
                disabled={ingestMutation.isPending}
                className="press px-4 py-2 bg-ws-accent text-ws-bg border-none rounded-ws-lg text-[11px] font-bold cursor-pointer flex items-center gap-2"
              >
                {ingestMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Connect Google Drive
              </button>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">Source Name</label>
                <input
                  type="text"
                  placeholder="Name this study note (e.g. Lecture 4 derivation notes)"
                  value={ingestName}
                  onChange={(e) => setIngestName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">
                  Copied Text Context
                </label>
                <textarea
                  placeholder="Paste your copied textbook text, definitions, formulas, or homework descriptions..."
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  className="w-full min-h-[90px] px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none resize-y font-[inherit]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Capacity bar */}
        <div className="px-6 pb-3 border-t border-ws-edge-soft pt-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-[10.5px] text-ws-muted">
            <span>Reference Source Capacity</span>
            <span>{sourceCount} / 100 loaded</span>
          </div>
          <div className="w-full h-1.5 bg-ws-bg rounded-[3px] overflow-hidden">
            <div
              style={{ width: `${Math.min(sourceCount, 100)}%` }}
              className="h-full bg-ws-accent rounded-[3px]"
            />
          </div>
        </div>

        {/* Error message */}
        {ingestMutation.error && (
          <div className="px-6 pb-3 text-red-500 text-xs font-semibold">
            {ingestMutation.error instanceof Error
              ? ingestMutation.error.message
              : 'Error ingesting source'}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-ws-surface-2 border-t border-ws-edge-soft flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="press px-3.5 py-2 bg-transparent border border-ws-edge-soft text-ws-soft rounded-ws-lg cursor-pointer text-[11.5px] font-semibold"
          >
            Cancel
          </button>
          {showSubmitButton && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className={`px-4 py-2 border-none rounded-ws-lg text-[11.5px] font-bold flex items-center gap-1.5 transition-colors duration-150 ${
                submitDisabled
                  ? 'bg-ws-surface-2 text-ws-muted cursor-not-allowed'
                  : 'bg-ws-accent text-ws-bg cursor-pointer'
              }`}
            >
              {ingestMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Ingest Source
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
