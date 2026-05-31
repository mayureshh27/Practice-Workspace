import { create } from 'zustand';
import type { Domain, WorkflowTemplate, Artifact, RecentItem, Subject, Chapter } from '../workspaceTypes';
import { INITIAL_DOMAINS, INITIAL_WORKFLOWS, INITIAL_ARTIFACTS } from './mockData';
import type { Problem, Store } from '../types';
import { API } from '../problemContent';
import { api, type ConceptMasteryDTO, type BlindSpotDTO } from '../api/workspaceApi';

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

  // Go Problems API integration
  goProblems: Problem[];
  isLoadingProblems: boolean;
  fetchGoProblems: () => Promise<any>;

  // Backend sync
  syncDomainsFromBackend: () => Promise<void>;

  // ── Chat state ───────────────────────────────────────────────────
  chatSessionId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  startChatSession: () => Promise<void>;
  endChatSession: () => Promise<void>;
  sendChatMessage: (text: string, conceptIds?: string[], sourceIds?: string[]) => Promise<void>;

  // ── Mastery state ────────────────────────────────────────────────
  masteryScores: ConceptMasteryDTO[];
  blindSpots: BlindSpotDTO[];
  fetchMastery: () => Promise<void>;
  fetchBlindSpots: () => Promise<void>;
  submitPracticeAttempt: (attempt: {
    sessionId?: string;
    artifactId?: string;
    conceptId?: string;
    verdict: string;
    hintCount?: number;
    durationMs?: number;
  }) => Promise<void>;

  // Domains
  setDomains: (domains: Domain[]) => void;
  renameDomain: (id: string, name: string) => void;
  deleteDomain: (id: string) => void;
  togglePinDomain: (id: string) => void;
  toggleArchiveDomain: (id: string) => void;
  addDomain: (name: string) => void;

  // Subjects
  addSubject: (domainId: string, name: string, description?: string) => void;
  renameSubject: (domainId: string, subjectId: string, name: string) => void;
  deleteSubject: (domainId: string, subjectId: string) => void;
  updateSubject: (domainId: string, subjectId: string, fields: Partial<Subject>) => void;

  // Chapters
  addChapter: (domainId: string, subjectId: string, name: string, description?: string) => void;
  updateChapter: (domainId: string, subjectId: string, chapterId: string, fields: Partial<Chapter>) => void;

  // Topics
  addTopic: (domainId: string, subjectId: string, chapterId: string, name: string) => void;

  // Resources
  addResource: (domainId: string, subjectId: string, name: string, fileType: string, linesCount: number) => void;
  removeResource: (domainId: string, subjectId: string, resourceId: string) => void;

  // Recents
  addToRecents: (label: string, type: RecentItem['type'], loc: any) => void;

  // Workflows
  saveWorkflow: (wf: WorkflowTemplate) => void;
  deleteWorkflow: (id: string) => void;
  updateWorkflow: (wf: WorkflowTemplate) => void;
  duplicateWorkflow: (id: string) => void;

  // Artifacts
  addArtifact: (art: Omit<Artifact, 'id' | 'time'>) => void;
  deleteArtifact: (id: string) => void;

  // Notebooks (simple string-keyed stubs for notebook route)
  notebooks: Record<string, string[]>;
  createNotebook: (domainId: string, subjectId: string, name: string) => void;
  deleteNotebook: (domainId: string, subjectId: string, id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  domains: getLocalStorageItem('domains', INITIAL_DOMAINS),
  workflows: getLocalStorageItem('workflows', INITIAL_WORKFLOWS),
  artifacts: getLocalStorageItem('artifacts', INITIAL_ARTIFACTS),
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
  goProblems: [],
  isLoadingProblems: false,

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

    // Auto-create session if none exists
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

    // Add user message
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

  // ── Mastery state ────────────────────────────────────────────────
  masteryScores: [],
  blindSpots: [],

  fetchMastery: async () => {
    try {
      const scores = await api.getMasteryScores();
      set({ masteryScores: scores });
    } catch (err) {
      console.error('Failed to fetch mastery scores:', err);
    }
  },

  fetchBlindSpots: async () => {
    try {
      const spots = await api.getBlindSpots();
      set({ blindSpots: spots });
    } catch (err) {
      console.error('Failed to fetch blind spots:', err);
    }
  },

  submitPracticeAttempt: async (attempt) => {
    try {
      await api.submitAttempt(attempt);
      // Refresh mastery scores after submission
      const scores = await api.getMasteryScores();
      const spots = await api.getBlindSpots();
      set({ masteryScores: scores, blindSpots: spots });
    } catch (err) {
      console.error('Failed to submit practice attempt:', err);
    }
  },

  // ── Backend sync ─────────────────────────────────────────────────
  syncDomainsFromBackend: async () => {
    try {
      const domains = await api.getDomains();
      setLocalStorageItem('domains', domains);
      set({ domains });
    } catch (err) {
      console.warn('Backend domain sync failed, using localStorage fallback:', err);
      // Keep existing localStorage data
    }
  },

  fetchGoProblems: async () => {
    set({ isLoadingProblems: true });
    try {
      const response = await fetch(`${API}/api/problems`);
      if (!response.ok) throw new Error('API failure');
      const data: Store = await response.json();
      set((state) => {
        const nextDomains = state.domains.map(d => {
          if (d.id !== 'go-programming') return d;
          return {
            ...d,
            subjects: d.subjects.map(sub => {
              if (sub.id !== 'go-fundamentals') return sub;
              
              const newChapters = data.chapters.map(ch => {
                const chProblems = data.problems.filter(p => p.chapter === ch.id);
                return {
                  id: ch.id,
                  name: ch.title,
                  description: ch.title,
                  topics: chProblems.map(p => ({
                    id: p.id,
                    name: p.title,
                    lastMessage: 'Not started'
                  }))
                };
              });
              
              return {
                ...sub,
                chapters: newChapters
              };
            })
          };
        });
        setLocalStorageItem('domains', nextDomains);
        return {
          goProblems: data.problems,
          isLoadingProblems: false,
          domains: nextDomains
        };
      });
    } catch (err) {
      console.error('Error fetching Go problems:', err);
      set({ isLoadingProblems: false });
    }
  },

  setDomains: (domains) => set(() => {
    setLocalStorageItem('domains', domains);
    return { domains };
  }),

  renameDomain: (id, name) => set((state) => {
    const next = state.domains.map(d => d.id === id ? { ...d, name } : d);
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  deleteDomain: (id) => set((state) => {
    const next = state.domains.filter(d => d.id !== id);
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  togglePinDomain: (id) => set((state) => {
    const next = state.domains.map(d => d.id === id ? { ...d, pinned: !d.pinned } : d);
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  toggleArchiveDomain: (id) => set((state) => {
    const next = state.domains.map(d => d.id === id ? { ...d, archived: !d.archived } : d);
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  addDomain: (name) => set((state) => {
    const newDomain: Domain = {
      id: `domain-${Date.now()}`,
      name,
      subjects: []
    };
    const next = [...state.domains, newDomain];
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  addSubject: (domainId, name, description) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      const newSubject: Subject = {
        id: `subject-${Date.now()}`,
        name,
        description,
        chapters: [
          {
            id: `c-init-${Date.now()}`,
            name: 'Chapter 1: Foundations',
            topics: []
          }
        ],
        resources: []
      };
      return { ...d, subjects: [...d.subjects, newSubject] };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  renameSubject: (domainId, subjectId, name) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => s.id === subjectId ? { ...s, name } : s)
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  deleteSubject: (domainId, subjectId) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.filter(s => s.id !== subjectId)
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  updateSubject: (domainId, subjectId, fields) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => s.id === subjectId ? { ...s, ...fields } : s)
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  addChapter: (domainId, subjectId, name, description) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => {
          if (s.id !== subjectId) return s;
          const newChapter: Chapter = {
            id: `chapter-${Date.now()}`,
            name,
            description: description || `Learning modules for ${name}.`,
            topics: []
          };
          return { ...s, chapters: [...s.chapters, newChapter] };
        })
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  updateChapter: (domainId, subjectId, chapterId, fields) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map(c => c.id === chapterId ? { ...c, ...fields } : c)
          };
        })
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  addTopic: (domainId, subjectId, chapterId, name) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map(c => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                topics: [...c.topics, { id: `topic-${Date.now()}`, name, lastMessage: 'Not started' }]
              };
            })
          };
        })
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  addResource: (domainId, subjectId, name, fileType, linesCount) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            resources: [...s.resources, { id: `res-${Date.now()}`, name, fileType, lines: linesCount }]
          };
        })
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

  removeResource: (domainId, subjectId, resourceId) => set((state) => {
    const next = state.domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subjects: d.subjects.map(s => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            resources: s.resources.filter(r => r.id !== resourceId)
          };
        })
      };
    });
    setLocalStorageItem('domains', next);
    return { domains: next };
  }),

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

  saveWorkflow: (wf) => set((state) => {
    const idx = state.workflows.findIndex(w => w.id === wf.id);
    let next;
    if (idx >= 0) {
      next = [...state.workflows];
      next[idx] = wf;
    } else {
      next = [...state.workflows, wf];
    }
    setLocalStorageItem('workflows', next);
    return { workflows: next };
  }),

  deleteWorkflow: (id) => set((state) => {
    const next = state.workflows.filter(w => w.id !== id);
    setLocalStorageItem('workflows', next);
    return { workflows: next };
  }),

  updateWorkflow: (wf) => set((state) => {
    const idx = state.workflows.findIndex(w => w.id === wf.id);
    let next;
    if (idx >= 0) {
      next = [...state.workflows];
      next[idx] = wf;
    } else {
      next = [...state.workflows, wf];
    }
    setLocalStorageItem('workflows', next);
    return { workflows: next };
  }),

  duplicateWorkflow: (id) => set((state) => {
    const wf = state.workflows.find(w => w.id === id);
    if (!wf) return state;
    const next = [...state.workflows, { ...wf, id: `wf-dup-${Date.now()}`, name: `${wf.name} (copy)` }];
    setLocalStorageItem('workflows', next);
    return { workflows: next };
  }),

  addArtifact: (art) => set((state) => {
    const newArt: Artifact = {
      ...art,
      id: `art-${Date.now()}`,
      time: 'Just now'
    };
    const next = [newArt, ...state.artifacts];
    setLocalStorageItem('artifacts', next);
    return { artifacts: next };
  }),

  deleteArtifact: (id) => set((state) => {
    const next = state.artifacts.filter(a => a.id !== id);
    setLocalStorageItem('artifacts', next);
    return { artifacts: next };
  }),

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
