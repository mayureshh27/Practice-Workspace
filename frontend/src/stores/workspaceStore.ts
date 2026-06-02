import { create } from 'zustand';
import type { Domain, WorkflowTemplate, Artifact, RecentItem, Subject, Chapter } from '../workspaceTypes';
import { INITIAL_DOMAINS, INITIAL_WORKFLOWS, INITIAL_ARTIFACTS } from './mockData';
import { api } from '../api/workspaceApi';

// ── Chat types ─────────────────────────────────────────────────────
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

const getLocalStorageItem = (key: string, fallback: any) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
  } catch (err) {
    console.warn(`Error reading localStorage key "${key}":`, err);
  }
  return fallback;
};

const setLocalStorageItem = (key: string, value: any) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`Error writing localStorage key "${key}":`, err);
  }
};

interface WorkspaceState {
  domains: Domain[];
  workflows: WorkflowTemplate[];
  artifacts: Artifact[];
  recentItems: RecentItem[];

  // ── Chat state ───────────────────────────────────────────────────
  chatSessionId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  startChatSession: () => Promise<void>;
  endChatSession: () => Promise<void>;
  sendChatMessage: (text: string, conceptIds?: string[], sourceIds?: string[]) => Promise<void>;

  // ── Practice attempt submission (delegated to backend event store) ─
  submitPracticeAttempt: (attempt: {
    sessionId?: string;
    artifactId?: string;
    conceptId?: string;
    verdict: string;
    hintCount?: number;
    durationMs?: number;
  }) => Promise<void>;

  setDomains: (domains: Domain[]) => void;
  setWorkflows: (workflows: WorkflowTemplate[]) => void;
  /** True when the backend Model Router has a real provider wired up. */
  modelConfigured: boolean;
  setModelConfigured: (configured: boolean) => void;

  // Domains — persisted to API + localStorage
  renameDomain: (id: string, name: string) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;
  togglePinDomain: (id: string) => Promise<void>;
  toggleArchiveDomain: (id: string) => Promise<void>;
  addDomain: (name: string) => Promise<void>;

  // Subjects — persisted to API + localStorage
  addSubject: (domainId: string, name: string, description?: string) => Promise<void>;
  renameSubject: (domainId: string, subjectId: string, name: string) => Promise<void>;
  deleteSubject: (domainId: string, subjectId: string) => Promise<void>;
  updateSubject: (domainId: string, subjectId: string, fields: Partial<Subject>) => void;

  // Chapters
  addChapter: (domainId: string, subjectId: string, name: string, description?: string) => Promise<void>;
  updateChapter: (domainId: string, subjectId: string, chapterId: string, fields: Partial<Chapter>) => void;

  // Topics
  addTopic: (domainId: string, subjectId: string, chapterId: string, name: string) => Promise<void>;

  // Resources
  addResource: (domainId: string, subjectId: string, name: string, fileType: string, linesCount: number) => void;
  removeResource: (domainId: string, subjectId: string, resourceId: string) => void;

  // Recents
  addToRecents: (label: string, type: RecentItem['type'], loc: any) => void;

  // Workflows — persisted to API
  saveWorkflow: (wf: WorkflowTemplate) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  updateWorkflow: (wf: WorkflowTemplate) => Promise<void>;
  duplicateWorkflow: (id: string) => Promise<WorkflowTemplate | null>;
  customizeWorkflow: (id: string, target: { subjectId?: string; chapterId?: string; topicId?: string }) => Promise<WorkflowTemplate | null>;

  // Artifacts
  addArtifact: (art: Omit<Artifact, 'id' | 'time'>) => Promise<Artifact | null>;
  deleteArtifact: (id: string) => void;

  // Practice run — calls the backend practice endpoint and refreshes
  // the artifacts query cache so the Studio's "Generated History"
  // panel updates without a manual reload.
  runWorkflow: (workflow: WorkflowTemplate, ctx: {
    domainId: string;
    subjectId: string;
    subjectName: string;
    chapterName?: string;
    topicName?: string;
    chapterId?: string;
    topicId?: string;
  }) => Promise<Artifact | null>;

  // Notebooks (simple string-keyed stubs for notebook route)
  notebooks: Record<string, string[]>;
  createNotebook: (domainId: string, subjectId: string, name: string) => void;
  deleteNotebook: (domainId: string, subjectId: string, id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  domains: getLocalStorageItem('domains', INITIAL_DOMAINS),
  workflows: getLocalStorageItem('workflows', INITIAL_WORKFLOWS),
  artifacts: getLocalStorageItem('artifacts', INITIAL_ARTIFACTS),
  modelConfigured: true,
  setWorkflows: (workflows) => {
    set({ workflows });
    setLocalStorageItem('workflows', workflows);
  },
  setModelConfigured: (configured) => set({ modelConfigured: configured }),
  recentItems: getLocalStorageItem('recentItems', [
    {
      id: 'recent-1',
      label: 'Degrees of Freedom',
      type: 'topic',
      loc: { level: 'topic', domainId: 'robotics', subjectId: 'modern-robotics', chapterId: 'c2', topicId: 'deg-freedom' },
      time: '2 hours ago'
    },
    {
      id: 'recent-2',
      label: 'Modern Robotics',
      type: 'subject',
      loc: { level: 'subject', domainId: 'robotics', subjectId: 'modern-robotics' },
      time: '3 hours ago'
    }
  ]),
  // ── Chat state ───────────────────────────────────────────────────
  chatSessionId: null,
  chatMessages: [],
  isChatLoading: false,

  startChatSession: async () => {
    try {
      const { sessionId } = await api.createChatSession();
      set({ chatSessionId: sessionId, chatMessages: [] });
    } catch (err) {
      console.error('Failed to start chat session:', err);
    }
  },

  endChatSession: async () => {
    const sessionId = useWorkspaceStore.getState().chatSessionId;
    if (!sessionId) return;
    try {
      await api.endChatSession(sessionId);
    } catch (err) {
      console.error('Failed to end chat session:', err);
    }
    set({ chatSessionId: null, chatMessages: [] });
  },

  sendChatMessage: async (text, conceptIds = [], sourceIds = []) => {
    let { chatSessionId } = useWorkspaceStore.getState();
    if (!chatSessionId) {
      try {
        const { sessionId } = await api.createChatSession();
        chatSessionId = sessionId;
        set({ chatSessionId: sessionId });
      } catch (err) {
        console.error('Failed to auto-create chat session:', err);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ chatMessages: [...state.chatMessages, userMsg], isChatLoading: true }));

    try {
      const response = await api.sendChatMessage(chatSessionId, text, conceptIds, sourceIds);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-resp`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMsg],
        isChatLoading: false,
      }));
    } catch (err) {
      console.error('Chat message failed:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'system',
        content: 'Failed to reach the tutor. Please check the backend connection.',
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, errorMsg],
        isChatLoading: false,
      }));
    }
  },

  submitPracticeAttempt: async (attempt) => {
    try {
      await api.submitAttempt(attempt);
    } catch (err) {
      console.error('Failed to submit practice attempt:', err);
    }
  },

  setDomains: (domains) => {
    set({ domains });
    setLocalStorageItem('domains', domains);
  },

  renameDomain: async (id, name) => {
    try {
      const updated = await api.renameDomain(id, name);
      set((state) => {
        const next = state.domains.map(d => d.id === id ? { ...d, name: updated.name } : d);
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to rename domain:', err);
    }
  },

  deleteDomain: async (id) => {
    try {
      await api.deleteDomain(id);
      set((state) => {
        const next = state.domains.filter(d => d.id !== id);
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to delete domain:', err);
    }
  },

  togglePinDomain: async (id) => {
    const current = useWorkspaceStore.getState().domains.find(d => d.id === id);
    if (!current) return;
    try {
      const updated = await api.togglePinDomain(id, !current.pinned);
      set((state) => {
        const next = state.domains.map(d => d.id === id ? { ...d, pinned: updated.pinned } : d);
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  },

  toggleArchiveDomain: async (id) => {
    const current = useWorkspaceStore.getState().domains.find(d => d.id === id);
    if (!current) return;
    try {
      const updated = await api.toggleArchiveDomain(id, !current.archived);
      set((state) => {
        const next = state.domains.map(d => d.id === id ? { ...d, archived: updated.archived } : d);
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  },

  addDomain: async (name) => {
    try {
      const created = await api.addDomain(name);
      set((state) => {
        const next = [...state.domains, created as any];
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to create domain:', err);
    }
  },

  addSubject: async (domainId, name, description) => {
    try {
      const created = await api.addSubject(domainId, name, description);
      set((state) => {
        const next = state.domains.map(d => d.id !== domainId ? d : {
          ...d, subjects: [...d.subjects, created as any]
        });
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to create subject:', err);
    }
  },

  renameSubject: async (domainId, subjectId, name) => {
    try {
      const updated = await api.renameSubject(domainId, subjectId, name);
      set((state) => {
        const next = state.domains.map(d => d.id !== domainId ? d : {
          ...d, subjects: d.subjects.map(s => s.id === subjectId ? { ...s, name: updated.name } : s)
        });
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to rename subject:', err);
    }
  },

  deleteSubject: async (domainId, subjectId) => {
    try {
      await api.deleteSubject(domainId, subjectId);
      set((state) => {
        const next = state.domains.map(d => d.id !== domainId ? d : {
          ...d, subjects: d.subjects.filter(s => s.id !== subjectId)
        });
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to delete subject:', err);
    }
  },

  updateSubject: (domainId, subjectId, fields) => {
    set((state) => {
      const next = state.domains.map(d => d.id !== domainId ? d : {
        ...d, subjects: d.subjects.map(s => s.id === subjectId ? { ...s, ...fields } : s)
      });
      setLocalStorageItem('domains', next);
      return { domains: next };
    });
  },

  addChapter: async (domainId, subjectId, name, description) => {
    try {
      const created = await api.addChapter(domainId, subjectId, name, description);
      set((state) => {
        const next = state.domains.map(d => d.id !== domainId ? d : {
          ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
            ...s, chapters: [...s.chapters, created as any]
          })
        });
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to create chapter:', err);
    }
  },

  updateChapter: (domainId, subjectId, chapterId, fields) => {
    set((state) => {
      const next = state.domains.map(d => d.id !== domainId ? d : {
        ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
          ...s, chapters: s.chapters.map(c => c.id === chapterId ? { ...c, ...fields } : c)
        })
      });
      setLocalStorageItem('domains', next);
      return { domains: next };
    });
  },

  addTopic: async (domainId, subjectId, chapterId, name) => {
    try {
      const created = await api.addTopic(domainId, subjectId, chapterId, name);
      set((state) => {
        const next = state.domains.map(d => d.id !== domainId ? d : {
          ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
            ...s, chapters: s.chapters.map(c => c.id !== chapterId ? c : {
              ...c, topics: [...c.topics, created as any]
            })
          })
        });
        setLocalStorageItem('domains', next);
        return { domains: next };
      });
    } catch (err) {
      console.error('Failed to create topic:', err);
    }
  },

  addResource: (domainId, subjectId, name, fileType, linesCount) => {
    set((state) => {
      const next = state.domains.map(d => d.id !== domainId ? d : {
        ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
          ...s, resources: [...s.resources, { id: `res-${Date.now()}`, name, fileType, lines: linesCount }]
        })
      });
      setLocalStorageItem('domains', next);
      return { domains: next };
    });
  },

  removeResource: (domainId, subjectId, resourceId) => {
    set((state) => {
      const next = state.domains.map(d => d.id !== domainId ? d : {
        ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
          ...s, resources: s.resources.filter(r => r.id !== resourceId)
        })
      });
      setLocalStorageItem('domains', next);
      return { domains: next };
    });
  },

  addToRecents: (label, type, loc) => set((state) => {
    const filtered = state.recentItems.filter(r => JSON.stringify(r.loc) !== JSON.stringify(loc));
    const newItem: RecentItem = {
      id: `recent-${Date.now()}`,
      label,
      type,
      loc,
      time: 'Just now'
    };
    const next = [newItem, ...filtered].slice(0, 5);
    setLocalStorageItem('recentItems', next);
    return { recentItems: next };
  }),

  saveWorkflow: async (wf) => {
    const existing = get().workflows.find(w => w.id === wf.id);
    try {
      const saved = existing
        ? await api.updateWorkflow(wf.id, wf as any)
        : await api.addWorkflow(wf as any);
      set((state) => {
        const idx = state.workflows.findIndex(w => w.id === saved.id);
        const next = idx >= 0
          ? state.workflows.map(w => w.id === saved.id ? saved : w)
          : [...state.workflows, saved];
        setLocalStorageItem('workflows', next);
        return { workflows: next };
      });
    } catch (err) {
      console.error('Failed to save workflow:', err);
    }
  },

  deleteWorkflow: async (id) => {
    try {
      await api.deleteWorkflow(id);
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      return;
    }
    set((state) => {
      const next = state.workflows.filter(w => w.id !== id);
      setLocalStorageItem('workflows', next);
      return { workflows: next };
    });
  },

  updateWorkflow: async (wf) => {
    try {
      const updated = await api.updateWorkflow(wf.id, wf as any);
      set((state) => {
        const next = state.workflows.map(w => w.id === updated.id ? updated : w);
        setLocalStorageItem('workflows', next);
        return { workflows: next };
      });
    } catch (err) {
      console.error('Failed to update workflow:', err);
    }
  },

  duplicateWorkflow: async (id) => {
    try {
      const copy = await api.duplicateWorkflow(id);
      set((state) => {
        const next = [...state.workflows, copy];
        setLocalStorageItem('workflows', next);
        return { workflows: next };
      });
      return copy;
    } catch (err) {
      console.error('Failed to duplicate workflow:', err);
      return null;
    }
  },

  customizeWorkflow: async (id, target) => {
    try {
      const fork = await api.customizeWorkflow(id, target);
      set((state) => {
        const next = [...state.workflows, fork];
        setLocalStorageItem('workflows', next);
        return { workflows: next };
      });
      return fork;
    } catch (err) {
      console.error('Failed to customise workflow:', err);
      return null;
    }
  },

  addArtifact: async (art) => {
    try {
      const created = await api.createArtifact({
        name: art.name,
        type: art.type,
        status: art.status,
        domainId: art.domainId,
        subjectId: art.subjectId,
        chapterId: art.chapterId,
        topicId: art.topicId,
      });
      set((state) => {
        const next = [created, ...state.artifacts];
        setLocalStorageItem('artifacts', next);
        return { artifacts: next };
      });
      return created;
    } catch (err) {
      console.error('Failed to create artifact:', err);
      return null;
    }
  },

  deleteArtifact: (id) => set((state) => {
    const next = state.artifacts.filter(a => a.id !== id);
    setLocalStorageItem('artifacts', next);
    return { artifacts: next };
  }),

  runWorkflow: async (workflow, ctx) => {
    try {
      const artifact = await api.runPracticeWorkflow({
        workflowId: workflow.id,
        domainId: ctx.domainId,
        subjectId: ctx.subjectId,
        chapterId: ctx.chapterId,
        topicId: ctx.topicId,
        count: workflow.practiceConfig?.count,
        difficulty: workflow.practiceConfig?.difficulty,
      });
      set((state) => {
        const next = [artifact, ...state.artifacts];
        setLocalStorageItem('artifacts', next);
        return { artifacts: next };
      });
      return artifact;
    } catch (err) {
      console.error('Workflow run failed:', err);
      throw err;
    }
  },

  notebooks: getLocalStorageItem('notebooks', {}),
  createNotebook: (domainId, subjectId, name) => set((state) => {
    const key = `${domainId}::${subjectId}`;
    const next = { ...state.notebooks, [key]: [...(state.notebooks[key] ?? []), name] };
    setLocalStorageItem('notebooks', next);
    return { notebooks: next };
  }),
  deleteNotebook: (domainId, subjectId, id) => set((state) => {
    const key = `${domainId}::${subjectId}`;
    const next = { ...state.notebooks, [key]: (state.notebooks[key] ?? []).filter(n => n !== id) };
    setLocalStorageItem('notebooks', next);
    return { notebooks: next };
  }),
}));
