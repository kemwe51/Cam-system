import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildPlanMetadata,
  buildProjectRevisionRecord,
  importSessionRecordSchema,
  projectRecordSchema,
  type ImportSessionRecord,
  type ProjectRecord,
  type ProjectRevisionRecord,
} from '@cam/model';
import { projectDraftSchema, type ProjectDraft } from '@cam/shared';

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>;
  load(projectId: string): Promise<ProjectRecord | null>;
  save(projectId: string, project: ProjectRecord | ProjectDraft): Promise<ProjectRecord>;
  listRevisions(projectId: string): Promise<ProjectRevisionRecord[]>;
}

export interface ImportSessionRepository {
  load(importId: string): Promise<ImportSessionRecord | null>;
  save(importSession: ImportSessionRecord): Promise<ImportSessionRecord>;
}

export interface DraftStore {
  load(projectId: string): Promise<ProjectRecord | null>;
  save(projectId: string, project: ProjectRecord | ProjectDraft): Promise<ProjectRecord>;
}

function normalizeProjectId(projectId: string): string {
  return projectId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function normalizeImportId(importId: string): string {
  return importId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function shouldLogProjectErrors(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env.CAM_LOG_TEST_PROJECT_ERRORS === 'true';
}

function logUnreadableProjectFile(file: string, error: unknown): void {
  if (shouldLogProjectErrors()) {
    console.warn(`Ignoring unreadable project file ${file}:`, error);
  }
}

function storeRoot(directory: string): string {
  return directory;
}

function projectsDirectory(directory: string): string {
  return join(storeRoot(directory), 'projects');
}

function importsDirectory(directory: string): string {
  return join(storeRoot(directory), 'imports');
}

function projectPath(directory: string, projectId: string): string {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    throw new Error('Project id is required.');
  }

  return join(projectsDirectory(directory), `${normalizedProjectId}.json`);
}

function importPath(directory: string, importId: string): string {
  const normalizedImportId = normalizeImportId(importId);
  if (!normalizedImportId) {
    throw new Error('Import id is required.');
  }

  return join(importsDirectory(directory), `${normalizedImportId}.json`);
}

function warningCount(project: ProjectRecord): number {
  return project.warnings.length + (project.derivedModel?.warnings.length ?? 0);
}

function optionalStringField(payload: unknown, field: string): string | undefined {
  const value = typeof payload === 'object' && payload !== null ? Reflect.get(payload, field) : undefined;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function optionalUnknownField(payload: unknown, field: string): unknown {
  return typeof payload === 'object' && payload !== null ? Reflect.get(payload, field) : undefined;
}

function toProjectRecord(projectId: string, payload: ProjectRecord | ProjectDraft, existing?: ProjectRecord, updatedAt = new Date().toISOString()): ProjectRecord {
  const parsedRecord = projectRecordSchema.safeParse(payload);
  const baseRecord: ProjectRecord = (parsedRecord.success
    ? parsedRecord.data
    : (() => {
        const legacyDraft = projectDraftSchema.parse(payload);
        return projectRecordSchema.parse({
          projectId,
          revision: Math.max(existing?.revision ?? 1, 1),
          ...(optionalStringField(payload, 'sourceImportId') ? { sourceImportId: optionalStringField(payload, 'sourceImportId') } : {}),
          ...(optionalStringField(payload, 'sourceType') ? { sourceType: optionalStringField(payload, 'sourceType') } : {}),
          ...(optionalStringField(payload, 'sourceFilename') ? { sourceFilename: optionalStringField(payload, 'sourceFilename') } : {}),
          ...(optionalUnknownField(payload, 'derivedModel') ? { derivedModel: optionalUnknownField(payload, 'derivedModel') } : {}),
          approvalState: legacyDraft.plan.approval.state,
          updatedAt,
          warnings: Array.isArray(optionalUnknownField(payload, 'warnings'))
            ? (optionalUnknownField(payload, 'warnings') as unknown[]).filter((value): value is string => typeof value === 'string')
            : [],
          plan: legacyDraft.plan,
          ...(legacyDraft.review ? { review: legacyDraft.review } : {}),
          ...(legacyDraft.selectedEntity ? { selectedEntity: legacyDraft.selectedEntity } : {}),
          revisions: existing?.revisions ?? [],
        });
      })()) as ProjectRecord;

  const nextRevision = (existing?.revision ?? 0) + 1;
  const draftRecord = projectRecordSchema.parse({
    ...baseRecord,
    projectId,
    revision: nextRevision,
    approvalState: baseRecord.plan.approval.state,
    updatedAt,
    planMetadata: buildPlanMetadata(baseRecord.plan),
    revisions: existing?.revisions ?? baseRecord.revisions,
  }) as ProjectRecord;

  const nextRevisionRecord = buildProjectRevisionRecord(
    projectId,
    nextRevision,
    draftRecord.plan,
    draftRecord.sourceImportId,
    warningCount(draftRecord),
    updatedAt,
  );

  return projectRecordSchema.parse({
    ...draftRecord,
    revisions: [...draftRecord.revisions, nextRevisionRecord],
  }) as ProjectRecord;
}

async function loadJsonFile<T>(filePath: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const payload = await readFile(filePath, 'utf8');
  return schema.parse(JSON.parse(payload));
}

export function createFileProjectRepository(
  directory = process.env.CAM_DRAFT_STORE_DIR ?? '/tmp/cam-system-drafts',
): ProjectRepository {
  return {
    async list() {
      const projectDir = projectsDirectory(directory);
      await mkdir(projectDir, { recursive: true });
      const files = await readdir(projectDir);
      const projects: ProjectRecord[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        try {
          projects.push(await loadJsonFile(join(projectDir, file), projectRecordSchema) as ProjectRecord);
        } catch (error) {
          logUnreadableProjectFile(file, error);
        }
      }

      return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async load(projectId) {
      try {
        return await loadJsonFile(projectPath(directory, projectId), projectRecordSchema) as ProjectRecord;
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
    async save(projectId, project) {
      const normalizedProjectId = normalizeProjectId(projectId);
      const projectDir = projectsDirectory(directory);
      await mkdir(projectDir, { recursive: true });
      const existing = await this.load(normalizedProjectId);
      const parsedProject = toProjectRecord(normalizedProjectId, project, existing ?? undefined);
      await writeFile(projectPath(directory, normalizedProjectId), JSON.stringify(parsedProject, null, 2), 'utf8');
      return parsedProject;
    },
    async listRevisions(projectId) {
      const project = await this.load(projectId);
      return project?.revisions ?? [];
    },
  };
}

export function createFileImportSessionRepository(
  directory = process.env.CAM_DRAFT_STORE_DIR ?? '/tmp/cam-system-drafts',
): ImportSessionRepository {
  return {
    async load(importId) {
      try {
        return await loadJsonFile(importPath(directory, importId), importSessionRecordSchema);
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
    async save(importSession) {
      const importDir = importsDirectory(directory);
      await mkdir(importDir, { recursive: true });
      const parsed = importSessionRecordSchema.parse(importSession);
      await writeFile(importPath(directory, parsed.id), JSON.stringify(parsed, null, 2), 'utf8');
      return parsed;
    },
  };
}

export function createJsonDraftStore(directory?: string): DraftStore {
  const repository = createFileProjectRepository(directory);
  return {
    load(projectId) {
      return repository.load(projectId);
    },
    save(projectId, project) {
      return repository.save(projectId, project);
    },
  };
}
