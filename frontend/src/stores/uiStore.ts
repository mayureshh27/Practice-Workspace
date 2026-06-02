import { create } from 'zustand';
import type { Theme, BaseColor, RadiusScale, FontOption } from '../types';
import type { RightDockPanel as RightDockPanelType, BottomDockTab } from '../workspaceTypes';
import { getBrowserStorage, readTextStorage, writeTextStorage } from '../appState';

type CreationModalType = 'domain' | 'subject' | 'chapter' | 'topic';

interface CreationModalState {
  open: boolean;
  type: CreationModalType;
  domainId?: string;
  subjectId?: string;
  chapterId?: string;
}

const SETTINGS_KEY = 'ws-settings';

interface PersistedSettings {
  base: BaseColor;
  radius: RadiusScale;
  fontHeading: FontOption;
  fontBody: FontOption;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  base: 'neutral',
  radius: 'default',
  fontHeading: 'inter',
  fontBody: 'inter',
};

const VALID_BASES: BaseColor[] = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];
const VALID_RADIUS: RadiusScale[] = ['none', 'sm', 'default', 'lg', 'full'];
const VALID_FONTS: FontOption[] = ['inter', 'ibm-plex', 'geist'];

function readPersistedSettings(): PersistedSettings {
  const raw = readTextStorage(getBrowserStorage(), SETTINGS_KEY, '');
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      base: VALID_BASES.includes(parsed.base as BaseColor) ? (parsed.base as BaseColor) : DEFAULT_SETTINGS.base,
      radius: VALID_RADIUS.includes(parsed.radius as RadiusScale) ? (parsed.radius as RadiusScale) : DEFAULT_SETTINGS.radius,
      fontHeading: VALID_FONTS.includes(parsed.fontHeading as FontOption) ? (parsed.fontHeading as FontOption) : DEFAULT_SETTINGS.fontHeading,
      fontBody: VALID_FONTS.includes(parsed.fontBody as FontOption) ? (parsed.fontBody as FontOption) : DEFAULT_SETTINGS.fontBody,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writePersistedSettings(settings: PersistedSettings) {
  writeTextStorage(getBrowserStorage(), SETTINGS_KEY, JSON.stringify(settings));
}

function applyToDocument(settings: PersistedSettings) {
  const html = document.documentElement;
  html.dataset.base = settings.base;
  html.dataset.radius = settings.radius;
  html.dataset.fontHeading = settings.fontHeading;
  html.dataset.fontBody = settings.fontBody;
}

interface UIState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Settings — user-tunable appearance
  base: BaseColor;
  radius: RadiusScale;
  fontHeading: FontOption;
  fontBody: FontOption;
  setBase: (base: BaseColor) => void;
  setRadius: (radius: RadiusScale) => void;
  setFontHeading: (font: FontOption) => void;
  setFontBody: (font: FontOption) => void;
  resetSettings: () => void;

  // Settings Panel UI
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;

  // Search Palette
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;

  // Creation Modal
  creationModal: CreationModalState | null;
  setCreationModal: (modal: CreationModalState | null) => void;
  modalName: string;
  setModalName: (name: string) => void;
  modalDesc: string;
  setModalDesc: (desc: string) => void;

  // Workspace Shell Layout
  leftCollapsed: boolean;
  setLeftCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleLeftCollapsed: () => void;
  practiceNavCollapsed: boolean;
  setPracticeNavCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  rightPanel: RightDockPanelType;
  setRightPanel: (panel: RightDockPanelType) => void;
  bottomOpen: boolean;
  setBottomOpen: (open: boolean) => void;
  bottomTab: BottomDockTab;
  setBottomTab: (tab: BottomDockTab) => void;
}

const initialSettings = readPersistedSettings();
if (typeof document !== 'undefined') applyToDocument(initialSettings);

export const useUIStore = create<UIState>((set, get) => ({
  theme: readTextStorage(getBrowserStorage(), 'theme', 'dark') === 'light' ? 'light' : 'dark',
  setTheme: (theme) => {
    writeTextStorage(getBrowserStorage(), 'theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.setProperty('color-scheme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      writeTextStorage(getBrowserStorage(), 'theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      document.documentElement.style.setProperty('color-scheme', newTheme);
      return { theme: newTheme };
    });
  },

  base: initialSettings.base,
  radius: initialSettings.radius,
  fontHeading: initialSettings.fontHeading,
  fontBody: initialSettings.fontBody,
  setBase: (base) => {
    const next = { ...readPersistedSettings(), base };
    writePersistedSettings(next);
    applyToDocument(next);
    set({ base });
  },
  setRadius: (radius) => {
    const next = { ...readPersistedSettings(), radius };
    writePersistedSettings(next);
    applyToDocument(next);
    set({ radius });
  },
  setFontHeading: (fontHeading) => {
    const next = { ...readPersistedSettings(), fontHeading };
    writePersistedSettings(next);
    applyToDocument(next);
    set({ fontHeading });
  },
  setFontBody: (fontBody) => {
    const next = { ...readPersistedSettings(), fontBody };
    writePersistedSettings(next);
    applyToDocument(next);
    set({ fontBody });
  },
  resetSettings: () => {
    writePersistedSettings(DEFAULT_SETTINGS);
    applyToDocument(DEFAULT_SETTINGS);
    set({ ...DEFAULT_SETTINGS });
  },

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  searchModalOpen: false,
  setSearchModalOpen: (open) => set({ searchModalOpen: open }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedIndex: 0,
  setSelectedIndex: (index) => set((state) => ({
    selectedIndex: typeof index === 'function' ? index(state.selectedIndex) : index
  })),

  creationModal: null,
  setCreationModal: (modal) => set({ creationModal: modal }),
  modalName: '',
  setModalName: (name) => set({ modalName: name }),
  modalDesc: '',
  setModalDesc: (desc) => set({ modalDesc: desc }),

  leftCollapsed: false,
  setLeftCollapsed: (collapsed) => set((state) => ({
    leftCollapsed: typeof collapsed === 'function' ? collapsed(state.leftCollapsed) : collapsed
  })),
  toggleLeftCollapsed: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
  practiceNavCollapsed: false,
  setPracticeNavCollapsed: (collapsed) => set((state) => ({
    practiceNavCollapsed: typeof collapsed === 'function' ? collapsed(state.practiceNavCollapsed) : collapsed
  })),
  rightPanel: null,
  setRightPanel: (panel) => set({ rightPanel: panel }),
  bottomOpen: false,
  setBottomOpen: (open) => set({ bottomOpen: open }),
  bottomTab: 'output',
  setBottomTab: (tab) => set({ bottomTab: tab }),
}));
