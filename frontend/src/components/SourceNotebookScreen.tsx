import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Domain, Subject, NavLocation, WorkflowTemplate } from '../workspaceTypes';
import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { artifactsQueries, workflowQueries } from '../api/queries';
import { SourcesColumn } from './notebook/SourcesColumn';
import { ChatColumn } from './notebook/ChatColumn';
import { StudioColumn } from './notebook/StudioColumn';
import { IngestionModal } from './notebook/IngestionModal';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

type Props = {
  domain: Domain;
  subject: Subject;
  onNavigate: (loc: NavLocation) => void;
};

function SourceNotebookScreen({ domain, subject, onNavigate }: Props) {
  // ── Column collapse ────────────────────────────────────────────────────
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  // ── Ingestion modal ────────────────────────────────────────────────────
  const [showAddSources, setShowAddSources] = useState(false);

  // ── Sources checklist ──────────────────────────────────────────────────
  const [sources, setSources] = useState(() =>
    subject.resources.map((res) => ({
      id: res.id,
      name: res.name,
      chunks: Math.ceil(res.lines / 20),
      selected: true,
    })),
  );

  useEffect(() => {
    setSources(
      subject.resources.map((res) => ({
        id: res.id,
        name: res.name,
        chunks: Math.ceil(res.lines / 20),
        selected: true,
      })),
    );
  }, [subject]);

  // ── Chat ───────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome to the Source Notebook for ${subject.name}! I have compiled **${subject.resources.length} resource files** from your current subject layers. Choose your files in the left sidebar to scope our context, and trigger slide, audio, or problem-set compilers in the Right Studio.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // ── Studio / workflow run ──────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastFailedId, setLastFailedId] = useState<string | null>(null);

  // ── Notes ─────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<string[]>([]);
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // ── Store / query selectors ────────────────────────────────────────────
  const setCreationModal = useUIStore((s) => s.setCreationModal);
  const { data: workflowsResp } = useQuery(workflowQueries.list());
  const workflows = workflowsResp?.items || [];
  const runWorkflow = useWorkspaceStore((s) => s.runWorkflow);
  const modelConfigured = workflowsResp?.modelConfigured ?? true;

  const studioWorkflows = useMemo(
    () =>
      workflows.filter(
        (wf) => wf.scope === 'global' || (wf.scope === 'subject' && wf.subjectId === subject.id),
      ),
    [workflows, subject.id],
  );

  const artifactsQuery = useQuery(artifactsQueries.list());
  const subjectArtifacts = useMemo(
    () => (artifactsQuery.data ?? []).filter((a) => a.subjectId === subject.id),
    [artifactsQuery.data, subject.id],
  );

  const firstChapterId = subject.chapters[0]?.id;

  // ── Derived ────────────────────────────────────────────────────────────
  const totalChunks = useMemo(
    () => sources.filter((s) => s.selected).reduce((acc, s) => acc + s.chunks, 0),
    [sources],
  );
  const allChecked = useMemo(
    () => sources.length > 0 && sources.every((s) => s.selected),
    [sources],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleToggleSource = (id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  };

  const handleSelectAll = () => {
    const allSelected = sources.every((s) => s.selected);
    setSources((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    // TODO Phase 10 — replace with real api.sendChatMessage
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `I've analyzed your custom prompt with our selected reference sources. What other study overview or C-Space coordinate transform explanation should we extract?`,
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleRunWorkflow = async (wf: WorkflowTemplate) => {
    setIsGenerating(wf.id);
    setRunError(null);
    setLastFailedId(null);
    try {
      const artifact = await runWorkflow(wf, {
        domainId: domain.id,
        subjectId: subject.id,
        subjectName: subject.name,
        chapterId: firstChapterId,
        chapterName: subject.chapters[0]?.name,
      });
      await artifactsQuery.refetch();
      setMessages((prev) => [
        ...prev,
        {
          id: `${artifact?.id ?? Date.now()}-ai`,
          role: 'assistant',
          content: `⚡ **${wf.name}** finished — generated **${wf.targetType}** for *${subject.name}*.`,
        },
      ]);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Workflow run failed.');
      setLastFailedId(wf.id);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleRetryLast = () => {
    const last = studioWorkflows.find((w) => w.id === lastFailedId);
    if (last) handleRunWorkflow(last);
  };

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      setNotes((prev) => [newNoteText.trim(), ...prev]);
      setNewNoteText('');
      setShowNotesForm(false);
    }
  };

  return (
    <div className="flex w-full h-full bg-ws-bg p-3 gap-3 overflow-hidden relative">
      <SourcesColumn
        sources={sources}
        totalChunks={totalChunks}
        allChecked={allChecked}
        collapsed={sourcesCollapsed}
        onToggle={handleToggleSource}
        onSelectAll={handleSelectAll}
        onAddSources={() => setShowAddSources(true)}
        onToggleCollapse={() => setSourcesCollapsed((v) => !v)}
      />

      <ChatColumn
        domain={domain}
        subject={subject}
        sources={sources}
        messages={messages}
        isTyping={isTyping}
        input={input}
        firstChapterId={firstChapterId}
        onSend={handleSend}
        onInputChange={setInput}
        onNavigate={onNavigate}
        onAddChapter={() =>
          setCreationModal({
            open: true,
            type: 'chapter',
            domainId: domain.id,
            subjectId: subject.id,
          })
        }
        onAddTopic={() =>
          firstChapterId &&
          setCreationModal({
            open: true,
            type: 'topic',
            domainId: domain.id,
            subjectId: subject.id,
            chapterId: firstChapterId,
          })
        }
      />

      <StudioColumn
        collapsed={studioCollapsed}
        studioWorkflows={studioWorkflows}
        isGenerating={isGenerating}
        runError={runError}
        modelConfigured={modelConfigured}
        subjectArtifacts={subjectArtifacts}
        artifactsStatus={{
          isFetching: artifactsQuery.isFetching,
          isLoading: artifactsQuery.isLoading,
          isError: artifactsQuery.isError,
        }}
        notes={notes}
        showNotesForm={showNotesForm}
        newNoteText={newNoteText}
        subjectId={subject.id}
        firstChapterId={firstChapterId}
        onRun={handleRunWorkflow}
        onDismissError={() => setRunError(null)}
        onRetryLast={handleRetryLast}
        onShowNotesForm={setShowNotesForm}
        onNoteTextChange={setNewNoteText}
        onAddNote={handleAddNote}
        onToggleCollapse={() => setStudioCollapsed((v) => !v)}
      />

      <IngestionModal
        open={showAddSources}
        onClose={() => setShowAddSources(false)}
        domainId={domain.id}
        subjectId={subject.id}
        sourceCount={sources.length}
      />
    </div>
  );
}

export default SourceNotebookScreen;
