import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectDraftSchema, type ProjectDraft } from '@cam/shared';

export interface DraftStore {
  load(projectId: string): Promise<ProjectDraft | null>;
  save(projectId: string, draft: ProjectDraft): Promise<ProjectDraft>;
}

function normalizeProjectId(projectId: string): string {
  return projectId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function draftPath(directory: string, projectId: string): string {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    throw new Error('Project id is required.');
  }

  return join(directory, `${normalizedProjectId}.json`);
}

export function createJsonDraftStore(
  directory = process.env.CAM_DRAFT_STORE_DIR ?? '/tmp/cam-system-drafts',
): DraftStore {
  return {
    async load(projectId) {
      try {
        const payload = await readFile(draftPath(directory, projectId), 'utf8');
        return projectDraftSchema.parse(JSON.parse(payload));
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          typeof error.code === 'string' &&
          error.code === 'ENOENT'
        ) {
          return null;
        }

        throw error;
      }
    },
    async save(projectId, draft) {
      const parsedDraft = projectDraftSchema.parse(draft);
      await mkdir(directory, { recursive: true });
      await writeFile(draftPath(directory, projectId), JSON.stringify(parsedDraft, null, 2), 'utf8');
      return parsedDraft;
    },
  };
}
