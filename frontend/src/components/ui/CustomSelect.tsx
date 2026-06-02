import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, style, className, disabled }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', display: 'inline-block', opacity: disabled ? 0.5 : 1, ...style }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full flex items-center justify-between gap-2 bg-transparent border-0 text-inherit text-inherit outline-none whitespace-nowrap overflow-hidden p-0 cursor-pointer disabled:cursor-not-allowed"
        style={{ fontSize: 'inherit' }}
      >
        <span className="overflow-hidden text-ellipsis flex-1 text-left">
          {selectedOption ? selectedOption.label : 'Select...'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-ws-muted" />
      </button>

      {isOpen && !disabled && (
        <div
          className="pop-pop origin-trigger-tl absolute top-full left-0 z-[1000] min-w-full w-max bg-ws-bg border border-ws-edge rounded-ws-md p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-h-60 overflow-y-auto flex flex-col gap-0.5"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className="flex items-center justify-between w-full px-3 py-2 bg-none border-0 rounded-ws-md text-xs text-left whitespace-nowrap cursor-pointer h-surface-2"
              style={{ color: value === opt.value ? 'var(--ws-accent)' : 'var(--ws-ink)' }}
            >
              {opt.label}
              {value === opt.value && <Check size={14} className="text-ws-accent ml-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
