import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Check, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import {
  type BaseColor,
  type RadiusScale,
  type FontOption,
  type Theme,
  BASE_COLOR_LABELS,
  RADIUS_LABELS,
  FONT_LABELS,
} from '../../types';

type SectionId = 'theme' | 'base' | 'radius' | 'fontHeading' | 'fontBody';

const BASE_COLOR_SWATCHES: Record<BaseColor, string> = {
  neutral: 'hsl(210, 8%, 50%)',
  stone:   'hsl(30,  5%, 50%)',
  zinc:    'hsl(240, 5%, 50%)',
  mauve:   'hsl(300, 5%, 50%)',
  olive:   'hsl(80,  5%, 50%)',
  mist:    'hsl(180, 5%, 50%)',
  taupe:   'hsl(25,  6%, 50%)',
};

const RADIUS_PREVIEW: Record<RadiusScale, string> = {
  none:    '0px',
  sm:      '2px',
  default: '6px',
  lg:      '10px',
  full:    '999px',
};

const FONT_SAMPLE: Record<FontOption, string> = {
  'inter':   'Inter',
  'ibm-plex':'IBM Plex Sans',
  'geist':   'Geist',
};

export function SettingsPanel() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const reset = useUIStore((s) => s.resetSettings);

  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const base = useUIStore((s) => s.base);
  const setBase = useUIStore((s) => s.setBase);
  const radius = useUIStore((s) => s.radius);
  const setRadius = useUIStore((s) => s.setRadius);
  const fontHeading = useUIStore((s) => s.fontHeading);
  const setFontHeading = useUIStore((s) => s.setFontHeading);
  const fontBody = useUIStore((s) => s.fontBody);
  const setFontBody = useUIStore((s) => s.setFontBody);

  const [expanded, setExpanded] = useState<SectionId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setExpanded(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expanded) {
          setExpanded(null);
        } else {
          setOpen(false);
        }
      }
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const trigger = document.querySelector('[data-settings-trigger]');
        if (trigger && trigger.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, expanded, setOpen]);

  if (!open) return null;

  const handleReset = () => {
    reset();
    setTheme('dark');
  };

  const toggleSection = (id: SectionId) => {
    setExpanded((cur) => (cur === id ? null : id));
  };

  return (
    <>
      <div
        className="fade-in fixed inset-0 z-40 bg-black/30"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Appearance settings"
        className="pop-pop origin-trigger-tr fixed top-12 right-4 z-50 flex flex-col w-[360px] max-h-[calc(100dvh-80px)] bg-ws-surface border border-ws-line-strong rounded-ws-lg overflow-hidden"
        style={{
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5), 0 4px 12px -4px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ws-line shrink-0">
          <h2 className="m-0 text-sm font-bold text-ws-ink tracking-tight">Appearance</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
            className="press h-cl-ink flex items-center justify-center w-6 h-6 text-ws-muted hover:text-ws-ink rounded-ws-sm bg-transparent border-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          <Section
            id="theme"
            label="Theme"
            value={theme === 'dark' ? 'Dark' : 'Light'}
            indicator={theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            expanded={expanded === 'theme'}
            onToggle={() => toggleSection('theme')}
          >
            <OptionList<Theme>
              options={[
                { value: 'dark',  label: 'Dark',  icon: <Moon size={14} /> },
                { value: 'light', label: 'Light', icon: <Sun size={14} /> },
              ]}
              current={theme}
              onSelect={(v) => { setTheme(v); setExpanded(null); }}
            />
          </Section>

          <Section
            id="base"
            label="Base Color"
            value={BASE_COLOR_LABELS[base]}
            indicator={<span className="block w-3 h-3 rounded-full border border-ws-line-strong" style={{ background: BASE_COLOR_SWATCHES[base] }} />}
            expanded={expanded === 'base'}
            onToggle={() => toggleSection('base')}
          >
            <OptionList<BaseColor>
              options={(
                ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'] as BaseColor[]
              ).map((v) => ({
                value: v,
                label: BASE_COLOR_LABELS[v],
                icon: <span className="block w-3 h-3 rounded-full border border-ws-line-strong" style={{ background: BASE_COLOR_SWATCHES[v] }} />,
              }))}
              current={base}
              onSelect={(v) => { setBase(v); setExpanded(null); }}
            />
          </Section>

          <Section
            id="radius"
            label="Radius"
            value={RADIUS_LABELS[radius]}
            indicator={<span className="block w-3 h-3 border border-ws-line-strong bg-ws-surface-2" style={{ borderRadius: RADIUS_PREVIEW[radius] }} />}
            expanded={expanded === 'radius'}
            onToggle={() => toggleSection('radius')}
          >
            <OptionList<RadiusScale>
              options={(
                ['none', 'sm', 'default', 'lg', 'full'] as RadiusScale[]
              ).map((v) => ({
                value: v,
                label: RADIUS_LABELS[v],
                icon: <span className="block w-3 h-3 border border-ws-line-strong bg-ws-surface-2" style={{ borderRadius: RADIUS_PREVIEW[v] }} />,
              }))}
              current={radius}
              onSelect={(v) => { setRadius(v); setExpanded(null); }}
            />
          </Section>

          <Section
            id="fontHeading"
            label="Heading"
            value={FONT_LABELS[fontHeading]}
            indicator={<span className="text-ws-ink font-bold text-[14px] leading-none">Aa</span>}
            expanded={expanded === 'fontHeading'}
            onToggle={() => toggleSection('fontHeading')}
          >
            <OptionList<FontOption>
              options={(
                ['inter', 'ibm-plex', 'geist'] as FontOption[]
              ).map((v) => ({
                value: v,
                label: FONT_LABELS[v],
                style: { fontFamily: `'${FONT_SAMPLE[v]}', system-ui, sans-serif` },
              }))}
              current={fontHeading}
              onSelect={(v) => { setFontHeading(v); setExpanded(null); }}
            />
          </Section>

          <Section
            id="fontBody"
            label="Body"
            value={FONT_LABELS[fontBody]}
            indicator={<span className="text-ws-ink font-bold text-[14px] leading-none">Aa</span>}
            expanded={expanded === 'fontBody'}
            onToggle={() => toggleSection('fontBody')}
          >
            <OptionList<FontOption>
              options={(
                ['inter', 'ibm-plex', 'geist'] as FontOption[]
              ).map((v) => ({
                value: v,
                label: FONT_LABELS[v],
                style: { fontFamily: `'${FONT_SAMPLE[v]}', system-ui, sans-serif` },
              }))}
              current={fontBody}
              onSelect={(v) => { setFontBody(v); setExpanded(null); }}
            />
          </Section>
        </div>

        <div className="px-2 py-2 border-t border-ws-line shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="press h-cl-ink w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-transparent border border-ws-line rounded-ws-md text-ws-muted text-xs font-semibold transition-colors cursor-pointer hover:text-ws-ink hover:border-ws-edge-strong"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}

interface SectionProps {
  id: SectionId;
  label: string;
  value: string;
  indicator: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ label, value, indicator, expanded, onToggle, children }: SectionProps) {
  return (
    <div className={`rounded-ws-md border transition-colors ${expanded ? 'border-ws-edge-strong bg-ws-surface-2' : 'border-ws-line bg-ws-surface'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="press w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-0 text-left cursor-pointer rounded-ws-md"
      >
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-medium text-ws-muted leading-none">{label}</span>
          <span className="text-[14px] font-bold text-ws-ink leading-none truncate">{value}</span>
        </div>
        <div className="shrink-0 flex items-center justify-center w-6 h-6 text-ws-muted">
          {indicator}
        </div>
      </button>
      {expanded && (
        <div className="px-2 pb-2 pt-1 border-t border-ws-line">
          {children}
        </div>
      )}
    </div>
  );
}

interface OptionItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

function OptionList<T extends string>({
  options,
  current,
  onSelect,
}: {
  options: OptionItem<T>[];
  current: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((opt) => {
        const isActive = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`press h-cl-ink flex items-center gap-2.5 px-2.5 py-1.5 rounded-ws-sm border-0 cursor-pointer transition-colors text-left ${
              isActive ? 'bg-ws-accent/10 text-ws-accent' : 'bg-transparent text-ws-soft hover:bg-ws-surface-3'
            }`}
            style={opt.style}
          >
            {opt.icon && <span className="shrink-0 flex items-center justify-center w-4 h-4">{opt.icon}</span>}
            <span className="flex-1 text-[13px] font-medium" style={opt.style}>{opt.label}</span>
            {isActive && <Check size={14} className="shrink-0 text-ws-accent" />}
          </button>
        );
      })}
    </div>
  );
}
