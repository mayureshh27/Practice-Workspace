import { create } from 'zustand';
import type { RecentItem, WorkflowTemplate } from '../workspaceTypes';
import { api, type ArtifactDTO } from '../api/workspaceApi';

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
  // ── UI-local state ────────────────────────────────────────────────
  modelConfigured: boolean;
  setModelConfigured: (configured: boolean) => void;

  recentItems: RecentItem[];
  addToRecents: (label: string, type: RecentItem['type'], loc: any) => void;

  notebooks: Record<string, string[]>;
  createNotebook: (domainId: string, subjectId: string, name: string) => void;
  deleteNotebook: (domainId: string, subjectId: string, id: string) => void;

  // ── Chat state ───────────────────────────────────────────────────
  chatSessionId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  startChatSession: () => Promise<void>;
  endChatSession: () => Promise<void>;
  sendChatMessage: (text: string, conceptIds?: string[], sourceIds?: string[]) => Promise<void>;

  // ── Practice attempt & Workflow runs ─────────────────────────────
  submitPracticeAttempt: (attempt: {
    sessionId?: string;
    artifactId?: string;
    conceptId?: string;
    verdict: string;
    hintCount?: number;
    durationMs?: number;
  }) => Promise<void>;

  runWorkflow: (
    workflow: WorkflowTemplate,
    ctx: {
      domainId: string;
      subjectId: string;
      subjectName: string;
      chapterName?: string;
      topicName?: string;
      chapterId?: string;
      topicId?: string;
    },
  ) => Promise<ArtifactDTO | null>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  modelConfigured: true,
  setModelConfigured: (configured) => set({ modelConfigured: configured }),

  recentItems: getLocalStorageItem('recentItems', [
    {
      id: 'recent-1',
      label: 'Degrees of Freedom',
      type: 'topic',
      loc: {
        level: 'topic',
        domainId: 'robotics',
        subjectId: 'modern-robotics',
        chapterId: 'c2',
        topicId: 'deg-freedom',
      },
      time: '2 hours ago',
    },
    {
      id: 'recent-2',
      label: 'Modern Robotics',
      type: 'subject',
      loc: { level: 'subject', domainId: 'robotics', subjectId: 'modern-robotics' },
      time: '3 hours ago',
    },
  ]),
  addToRecents: (label, type, loc) =>
    set((state) => {
      const filtered = state.recentItems.filter(
        (r) => JSON.stringify(r.loc) !== JSON.stringify(loc),
      );
      const newItem: RecentItem = {
        id: `recent-${Date.now()}`,
        label,
        type,
        loc,
        time: 'Just now',
      };
      const next = [newItem, ...filtered].slice(0, 5);
      setLocalStorageItem('recentItems', next);
      return { recentItems: next };
    }),

  notebooks: getLocalStorageItem('notebooks', {}),
  createNotebook: (domainId, subjectId, name) =>
    set((state) => {
      const key = `${domainId}::${subjectId}`;
      const next = { ...state.notebooks, [key]: [...(state.notebooks[key] ?? []), name] };
      setLocalStorageItem('notebooks', next);
      return { notebooks: next };
    }),
  deleteNotebook: (domainId, subjectId, id) =>
    set((state) => {
      const key = `${domainId}::${subjectId}`;
      const next = {
        ...state.notebooks,
        [key]: (state.notebooks[key] ?? []).filter((n) => n !== id),
      };
      setLocalStorageItem('notebooks', next);
      return { notebooks: next };
    }),

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
    const sessionId = get().chatSessionId;
    if (!sessionId) return;
    try {
      await api.endChatSession(sessionId);
    } catch (err) {
      console.error('Failed to end chat session:', err);
    }
    set({ chatSessionId: null, chatMessages: [] });
  },

  sendChatMessage: async (text, conceptIds = [], sourceIds = []) => {
    let { chatSessionId } = get();
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
      return artifact;
    } catch (err) {
      console.error('Workflow run failed:', err);
      throw err;
    }
  },
}));
