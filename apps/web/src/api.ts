import type { ImportSessionRecord, ProjectRecord } from '@cam/model';
import type { CamReview, DraftCamPlan, PartInput } from '@cam/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function loadSamplePart(): Promise<PartInput> {
  return fetchJson<PartInput>('/sample');
}

export function importSampleJson(): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>('/imports/json', {
    method: 'POST',
    body: JSON.stringify({
      fileName: 'sample.json',
      useSample: true,
    }),
  });
}

export function importJsonPayload(partInput: PartInput, fileName = 'structured-part.json'): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>('/imports/json', {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      partInput,
    }),
  });
}

export function importJsonText(content: string, fileName = 'structured-part.json'): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>('/imports/json', {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      content,
    }),
  });
}

export function importDxfText(content: string, fileName = 'incoming-model.dxf'): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>('/imports/dxf', {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      mediaType: 'application/dxf',
      content,
    }),
  });
}

export function importPlaceholder(format: 'step', fileName: string, content = ''): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>(`/imports/${format}`, {
    method: 'POST',
    body: JSON.stringify({
      fileName,
      content,
    }),
  });
}

export function loadImportSession(importId: string): Promise<ImportSessionRecord> {
  return fetchJson<ImportSessionRecord>(`/imports/${encodeURIComponent(importId)}`);
}

export function generateDraftPlan(part: PartInput): Promise<DraftCamPlan> {
  return fetchJson<DraftCamPlan>('/plan', {
    method: 'POST',
    body: JSON.stringify(part),
  });
}

export function reviewDraftPlan(
  plan: DraftCamPlan,
  context?: { importSession?: ImportSessionRecord | null; project?: ProjectRecord | null; model?: ProjectRecord['derivedModel'] | null },
): Promise<CamReview> {
  return fetchJson<CamReview>('/review', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      ...(context
        ? {
            context: {
              ...(context.importSession ? { importSession: context.importSession } : {}),
              ...(context.project ? { project: context.project } : {}),
              ...(context.model ? { model: context.model } : {}),
            },
          }
        : {}),
    }),
  });
}

export function approveDraftPlan(plan: DraftCamPlan): Promise<DraftCamPlan> {
  return fetchJson<DraftCamPlan>('/approve', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      approver: 'Workbench Programmer',
      notes: 'Approved from the CAM workbench foundation UI.',
    }),
  });
}

export function listProjects(): Promise<{ projects: ProjectRecord[] }> {
  return fetchJson<{ projects: ProjectRecord[] }>('/projects');
}

export function saveProjectRecord(project: ProjectRecord): Promise<ProjectRecord> {
  return fetchJson<ProjectRecord>(`/projects/${encodeURIComponent(project.projectId)}`, {
    method: 'PUT',
    body: JSON.stringify(project),
  });
}

export function loadProjectRecord(projectId: string): Promise<ProjectRecord> {
  return fetchJson<ProjectRecord>(`/projects/${encodeURIComponent(projectId)}`);
}
