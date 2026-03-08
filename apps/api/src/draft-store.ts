import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildProjectMetadata,
  projectDraftSchema,
  projectSummarySchema,
  type ProjectDraft,
  type ProjectSummary,
} from '@cam/shared';

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(projectId: string): Promise<ProjectDraft | null>;
  save(projectId: string, draft: ProjectDraft): Promise<ProjectDraft>;
}

export interface DraftStore {
  load(projectId: string): Promise<ProjectDraft | null>;
  save(projectId: string, draft: ProjectDraft): Promise<ProjectDraft>;
}

function normalizeProjectId(projectId: string): string {
  return projectId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function projectPath(directory: string, projectId: string): string {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    throw new Error('Project id is required.');
  }

  return join(directory, `${normalizedProjectId}.json`);
}

function enrichDraft(projectId: string, draft: ProjectDraft, updatedAt = draft.savedAt ?? new Date().toISOString()): ProjectDraft {
  const metadata = draft.metadata ?? buildProjectMetadata(projectId, draft.plan, updatedAt, false);
  return projectDraftSchema.parse({
    ...draft,
    projectId,
    metadata,
    savedAt: updatedAt,
  });
}

export function createFileProjectRepository(
  directory = process.env.CAM_DRAFT_STORE_DIR ?? '/tmp/cam-system-drafts',
): ProjectRepository {
  return {
    async list() {
      await mkdir(directory, { recursive: true });
      const files = await readdir(directory);
      const projects: ProjectSummary[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        try {
          const payload = await readFile(join(directory, file), 'utf8');
          const draft = enrichDraft(file.replace(/\.json$/, ''), projectDraftSchema.parse(JSON.parse(payload)));
          projects.push(projectSummarySchema.parse(draft.metadata));
        } catch {
          // Ignore malformed files so one bad draft does not block the repository.
        }
      }

      return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async load(projectId) {
      try {
        const payload = await readFile(projectPath(directory, projectId), 'utf8');
        return enrichDraft(projectId, projectDraftSchema.parse(JSON.parse(payload)));
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
      await mkdir(directory, { recursive: true });
      const updatedAt = new Date().toISOString();
      const parsedDraft = enrichDraft(projectId, projectDraftSchema.parse(draft), updatedAt);
      await writeFile(projectPath(directory, projectId), JSON.stringify(parsedDraft, null, 2), 'utf8');
      return parsedDraft;
    },
  };
}

export function createJsonDraftStore(directory?: string): DraftStore {
  const repository = createFileProjectRepository(directory);
  return {
    load(projectId) {
      return repository.load(projectId);
    },
    save(projectId, draft) {
      return repository.save(projectId, draft);
    },
  };
}
