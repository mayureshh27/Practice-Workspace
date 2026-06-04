import { StickyNote } from 'lucide-react';

type Props = {
  notes: string[];
  showNotesForm: boolean;
  newNoteText: string;
  onShowNotesForm: (show: boolean) => void;
  onNoteTextChange: (text: string) => void;
  onAddNote: () => void;
};

export function NotesPanel({
  notes,
  showNotesForm,
  newNoteText,
  onShowNotesForm,
  onNoteTextChange,
  onAddNote,
}: Props) {
  return (
    <div className="mt-auto pt-3 border-t border-ws-edge-soft">
      {notes.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-2.5">
            Personal Notes
          </div>
          <div className="flex flex-col gap-1.5">
            {notes.map((note, index) => (
              <div
                key={index}
                className="p-2.5 border border-ws-edge-soft rounded-ws-md bg-ws-bg text-[11px] text-ws-soft leading-[1.4]"
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {showNotesForm ? (
        <div className="bg-ws-bg border border-ws-edge rounded-ws-md p-2 flex flex-col gap-2 mb-2">
          <textarea
            value={newNoteText}
            onChange={(e) => onNoteTextChange(e.target.value)}
            placeholder="Type note text..."
            className="w-full min-h-[60px] p-1.5 bg-ws-bg border border-ws-edge-soft rounded-ws-sm text-ws-ink text-[11px] outline-none resize-y"
            autoFocus
          />
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              onClick={onAddNote}
              className="press px-2 py-[3px] bg-ws-accent text-ws-bg border-none rounded-[3px] text-[10px] font-bold cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => onShowNotesForm(false)}
              className="press px-2 py-[3px] bg-transparent border border-ws-edge-soft text-ws-soft rounded-[3px] text-[10px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onShowNotesForm(true)}
          className="press w-full px-3 py-2 bg-ws-accent border-none rounded-ws-md text-ws-bg font-bold text-[11px] flex items-center gap-1.5 justify-center cursor-pointer"
        >
          <StickyNote size={12} /> Add note
        </button>
      )}
    </div>
  );
}
