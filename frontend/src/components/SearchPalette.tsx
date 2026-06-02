import { useUIStore } from '../stores/uiStore';
import { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command';

export function SearchPalette() {
  const isOpen = useUIStore((s) => s.searchModalOpen);
  const setOpen = useUIStore((s) => s.setSearchModalOpen);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(o) => !o && setOpen(false)}
      title="Search"
      description="Search commands, documents, and workflows"
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search commands, documents, and workflows..."
      />
      <CommandList>
        <CommandEmpty>No recent searches. Try searching for &quot;React&quot; or &quot;Design Patterns&quot;.</CommandEmpty>
      </CommandList>
    </CommandDialog>
  );
}
