import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ingestSource } from './sourcesApi';
import { api } from './workspaceApi';

export function useIngestMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ingestSource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      onSuccess?.();
    },
  });
}

// ── Domain Mutations ────────────────────────────────────────────────
export function useAddDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.addDomain(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useRenameDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameDomain(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useDeleteDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDomain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useTogglePinDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.togglePinDomain(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useToggleArchiveDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.toggleArchiveDomain(id, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// ── Subject Mutations ────────────────────────────────────────────────
export function useAddSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      name,
      description,
    }: {
      domainId: string;
      name: string;
      description?: string;
    }) => api.addSubject(domainId, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useRenameSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      subjectId,
      name,
    }: {
      domainId: string;
      subjectId: string;
      name: string;
    }) => api.renameSubject(domainId, subjectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useDeleteSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, subjectId }: { domainId: string; subjectId: string }) =>
      api.deleteSubject(domainId, subjectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useUpdateSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Stub implementation since there's no real updateSubject API method yet
    mutationFn: async ({
      domainId,
      subjectId,
      fields,
    }: {
      domainId: string;
      subjectId: string;
      fields: any;
    }) => {
      if (fields.name) await api.renameSubject(domainId, subjectId, fields.name);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// ── Chapter/Topic Mutations ──────────────────────────────────────────
export function useAddChapterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      subjectId,
      name,
      description,
    }: {
      domainId: string;
      subjectId: string;
      name: string;
      description?: string;
    }) => api.addChapter(domainId, subjectId, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useUpdateChapterMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Stub
    mutationFn: async (_params: {
      domainId: string;
      subjectId: string;
      chapterId: string;
      fields: any;
    }) => {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
export function useAddTopicMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      subjectId,
      chapterId,
      name,
    }: {
      domainId: string;
      subjectId: string;
      chapterId: string;
      name: string;
    }) => api.addTopic(domainId, subjectId, chapterId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// ── Resource Mutations ──────────────────────────────────────────────
export function useRemoveResourceMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Stub
    mutationFn: async (_params: { domainId: string; subjectId: string; resourceId: string }) => {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// ── Workflow Mutations ───────────────────────────────────────────────
import type { WorkflowTemplate } from '../workspaceTypes';

export function useSaveWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wf: WorkflowTemplate) => {
      const { id, ...rest } = wf;
      // Convert nulls to undefined to satisfy Exact types if needed, though most APIs accept null/undefined
      const payload = {
        ...rest,
        subjectId: rest.subjectId ?? undefined,
        chapterId: rest.chapterId ?? undefined,
        topicId: rest.topicId ?? undefined,
        lastRun: rest.lastRun ?? undefined,
        practiceConfig: rest.practiceConfig ?? undefined,
      };

      if (id && !id.startsWith('wf-')) {
        return api.updateWorkflow(id, payload);
      } else {
        return api.addWorkflow(payload);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useDeleteWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkflow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useDuplicateWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.duplicateWorkflow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useCustomizeWorkflowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      target,
    }: {
      id: string;
      target: { subjectId?: string; chapterId?: string; topicId?: string };
    }) => api.customizeWorkflow(id, target),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

// ── Artifact Mutations ───────────────────────────────────────────────
export function useDeleteArtifactMutation() {
  const qc = useQueryClient();
  return useMutation({
    // Stub
    mutationFn: async (_id: string) => {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ['artifacts'] }),
  });
}
