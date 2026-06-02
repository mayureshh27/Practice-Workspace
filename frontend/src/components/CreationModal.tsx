import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { ModalShell } from './ModalShell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function CreationModal() {
  const modal = useUIStore(s => s.creationModal);
  const setModal = useUIStore(s => s.setCreationModal);
  const modalName = useUIStore(s => s.modalName);
  const setModalName = useUIStore(s => s.setModalName);
  const modalDesc = useUIStore(s => s.modalDesc);
  const setModalDesc = useUIStore(s => s.setModalDesc);

  const addDomain = useWorkspaceStore(s => s.addDomain);
  const addSubject = useWorkspaceStore(s => s.addSubject);
  const addChapter = useWorkspaceStore(s => s.addChapter);
  const addTopic = useWorkspaceStore(s => s.addTopic);

  const handleClose = () => {
    setModal(null);
    setModalName('');
    setModalDesc('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim() || !modal) return;

    if (modal.type === 'domain') {
      addDomain(modalName.trim());
    } else if (modal.type === 'subject' && modal.domainId) {
      addSubject(modal.domainId, modalName.trim(), modalDesc.trim());
    } else if (modal.type === 'chapter' && modal.domainId && modal.subjectId) {
      addChapter(modal.domainId, modal.subjectId, modalName.trim(), modalDesc.trim());
    } else if (modal.type === 'topic' && modal.domainId && modal.subjectId && modal.chapterId) {
      addTopic(modal.domainId, modal.subjectId, modal.chapterId, modalName.trim());
    }

    handleClose();
  };

  if (!modal || !modal.open) return null;

  const title = `New ${modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}`;
  const showDesc = modal.type === 'subject' || modal.type === 'chapter';

  return (
    <ModalShell open={true} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="creation-name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Name
          </Label>
          <Input
            id="creation-name"
            type="text"
            required
            autoFocus
            value={modalName}
            onChange={e => setModalName(e.target.value)}
            placeholder={`Enter ${modal.type} name...`}
          />
        </div>

        {showDesc && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creation-desc" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              id="creation-desc"
              value={modalDesc}
              onChange={e => setModalDesc(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="resize-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="press"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="press"
          >
            Create
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
