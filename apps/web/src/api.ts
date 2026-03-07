import type { CamReview, DraftCamPlan, PartInput, ProjectDraft } from '@cam/shared';

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

export function generateDraftPlan(part: PartInput): Promise<DraftCamPlan> {
  return fetchJson<DraftCamPlan>('/plan', {
    method: 'POST',
    body: JSON.stringify(part),
  });
}

export function reviewDraftPlan(plan: DraftCamPlan): Promise<CamReview> {
  return fetchJson<CamReview>('/review', {
    method: 'POST',
    body: JSON.stringify({ plan }),
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

export function saveProjectDraft(projectDraft: ProjectDraft): Promise<ProjectDraft> {
  return fetchJson<ProjectDraft>(`/drafts/${encodeURIComponent(projectDraft.projectId)}`, {
    method: 'PUT',
    body: JSON.stringify(projectDraft),
  });
}

export function loadProjectDraft(projectId: string): Promise<ProjectDraft> {
  return fetchJson<ProjectDraft>(`/drafts/${encodeURIComponent(projectId)}`);
}
