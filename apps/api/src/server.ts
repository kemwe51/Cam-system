import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { reviewDraftPlan, type ReviewSupplementalContext } from '@cam/ai';
import { buildNativeWorkbenchSnapshot, importedModelSchema, projectRecordSchema, type ImportSessionRecord } from '@cam/model';
import { approvePlan, planPart, regenerateDraftPlan, samplePartInput } from '@cam/engine';
import { defaultImporterRegistry, type ImportFormat, type ImportResult, type ImportedPartSource } from '@cam/importers';
import {
  approvalRequestSchema,
  partInputSchema,
  projectDraftSchema,
  draftCamPlanSchema,
} from '@cam/shared';
import { ZodError, z } from 'zod';
import {
  createFileImportSessionRepository,
  createFileProjectRepository,
  type ImportSessionRepository,
  type ProjectRepository,
} from './draft-store.js';

export type CamApiServerOptions = {
  port?: number;
  projectRepository?: ProjectRepository;
  importSessionRepository?: ImportSessionRepository;
};

const defaultPort = Number(process.env.PORT ?? 3001);

if (process.env.NODE_ENV === 'production' && !process.env.CAM_WEB_ORIGIN) {
  throw new Error('CAM_WEB_ORIGIN must be set when NODE_ENV=production.');
}

const allowedOrigins = new Set(
  (
    process.env.CAM_WEB_ORIGIN ??
    'http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const importJsonRequestSchema = z.object({
  sourceId: z.string().min(1).optional(),
  fileName: z.string().min(1).default('structured-part.json'),
  mediaType: z.string().min(1).default('application/json'),
  useSample: z.boolean().default(false),
  content: z.string().min(1).optional(),
  partInput: partInputSchema.optional(),
});

const importMetadataRequestSchema = z.object({
  sourceId: z.string().min(1).optional(),
  fileName: z.string().min(1),
  mediaType: z.string().min(1).optional(),
  content: z.string().default(''),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const reviewRequestSchema = z.object({
  plan: draftCamPlanSchema,
  context: z.object({
    importSession: z.custom<ReviewSupplementalContext['importSession']>().optional(),
    project: z.custom<ReviewSupplementalContext['project']>().optional(),
    model: importedModelSchema.optional(),
  }).optional(),
});

const regenerateOperationsRequestSchema = z.object({
  plan: draftCamPlanSchema,
  selectedFeatureIds: z.array(z.string().min(1)).default([]),
  preserveFrozenEdited: z.boolean().default(true),
});

function corsHeaders(requestOrigin?: string): Record<string, string> {
  const origin = requestOrigin && allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : !requestOrigin
      ? [...allowedOrigins][0] ?? ''
      : '';

  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    Vary: 'Origin',
  };
}

function matchRoute(pathname: string, prefix: string): string | null {
  const match = new RegExp(`^/${prefix}/([^/]+)$`).exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function matchProjectWorkbenchRoute(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/native-workbench$/.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function sendJson(
  response: import('node:http').ServerResponse,
  statusCode: number,
  body: unknown,
  requestOrigin?: string,
): void {
  response.writeHead(statusCode, {
    ...corsHeaders(requestOrigin),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);

    const totalLength = chunks.reduce((sum, item) => sum + item.length, 0);
    if (totalLength > 1_000_000) {
      throw new Error('Request body too large.');
    }
  }

  const payload = Buffer.concat(chunks).toString('utf8');
  return payload.length === 0 ? {} : JSON.parse(payload);
}

function importSessionId(prefix: ImportFormat) {
  return `import-${prefix}-${randomUUID()}`;
}

function importerSource(format: ImportFormat, body: z.infer<typeof importJsonRequestSchema> | z.infer<typeof importMetadataRequestSchema>, content: string): ImportedPartSource {
  const sizeBytes = 'sizeBytes' in body ? body.sizeBytes : Buffer.byteLength(content, 'utf8');
  const source: ImportedPartSource = {
    sourceId: body.sourceId ?? importSessionId(format),
    fileName: body.fileName,
    fileType: format,
    mediaType: body.mediaType ?? (format === 'json' ? 'application/json' : 'application/octet-stream'),
    content,
    ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
  };
  return source;
}

function toImportSession(result: ImportResult): ImportSessionRecord {
  const timestamp = new Date().toISOString();
  return {
    id: result.source.id,
    source: result.source,
    importStatus: result.importStatus,
    warnings: result.warnings,
    importedModel: result.importedModel,
    deterministicPartInput: result.deterministicPartInput,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createCamApiServer(options: CamApiServerOptions = {}) {
  const projectRepository = options.projectRepository ?? createFileProjectRepository();
  const importSessionRepository = options.importSessionRepository ?? createFileImportSessionRepository();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const requestOrigin = request.headers.origin;

      if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
        sendJson(response, 403, { error: 'Origin not allowed' }, requestOrigin);
        return;
      }

      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          ...corsHeaders(requestOrigin),
        });
        response.end();
        return;
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          status: 'ok',
          service: 'cam-api',
          timestamp: new Date().toISOString(),
        }, requestOrigin);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/sample') {
        sendJson(response, 200, samplePartInput, requestOrigin);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/projects') {
        sendJson(response, 200, { projects: await projectRepository.list() }, requestOrigin);
        return;
      }

      const nativeWorkbenchProjectId = matchProjectWorkbenchRoute(url.pathname);
      if (request.method === 'GET' && nativeWorkbenchProjectId) {
        const project = await projectRepository.load(nativeWorkbenchProjectId);
        if (!project) {
          sendJson(response, 404, {
            error: 'Project not found',
            projectId: nativeWorkbenchProjectId,
          }, requestOrigin);
          return;
        }

        sendJson(response, 200, buildNativeWorkbenchSnapshot(project), requestOrigin);
        return;
      }

      const importId = matchRoute(url.pathname, 'imports');
      if (request.method === 'GET' && importId) {
        const importSession = await importSessionRepository.load(importId);
        if (!importSession) {
          sendJson(response, 404, { error: 'Import session not found', importId }, requestOrigin);
          return;
        }
        sendJson(response, 200, importSession, requestOrigin);
        return;
      }

      const projectId = matchRoute(url.pathname, 'projects') ?? matchRoute(url.pathname, 'drafts');
      if (request.method === 'GET' && projectId) {
        const project = await projectRepository.load(projectId);
        if (!project) {
          sendJson(response, 404, {
            error: 'Project not found',
            projectId,
          }, requestOrigin);
          return;
        }

        sendJson(response, 200, project, requestOrigin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/imports/json') {
        const body = importJsonRequestSchema.parse(await readJson(request));
        const partInput = body.useSample ? samplePartInput : body.partInput ?? partInputSchema.parse(JSON.parse(body.content ?? '{}'));
        const result = await defaultImporterRegistry.importPart(importerSource('json', body, JSON.stringify(partInput)));
        const session = await importSessionRepository.save(toImportSession(result));
        sendJson(response, 201, session, requestOrigin);
        return;
      }

      if (request.method === 'POST' && (url.pathname === '/imports/dxf' || url.pathname === '/imports/step')) {
        const format = url.pathname.endsWith('/dxf') ? 'dxf' : 'step';
        const body = importMetadataRequestSchema.parse(await readJson(request));
        const result = await defaultImporterRegistry.importPart(importerSource(format, body, body.content));
        const session = await importSessionRepository.save(toImportSession(result));
        sendJson(response, 201, session, requestOrigin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/plan') {
        const body = partInputSchema.parse(await readJson(request));
        sendJson(response, 200, planPart(body), requestOrigin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/operations/generate') {
        const body = partInputSchema.parse(await readJson(request));
        sendJson(response, 200, planPart(body), requestOrigin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/operations/regenerate') {
        const body = regenerateOperationsRequestSchema.parse(await readJson(request));
        sendJson(
          response,
          200,
          regenerateDraftPlan(body.plan, {
            selectedFeatureIds: body.selectedFeatureIds,
            preserveFrozenEdited: body.preserveFrozenEdited,
          }),
          requestOrigin,
        );
        return;
      }

      if (request.method === 'POST' && url.pathname === '/review') {
        const body = reviewRequestSchema.parse(await readJson(request));
        const reviewOptions: Parameters<typeof reviewDraftPlan>[1] = {};
        if (process.env.OPENAI_API_KEY) {
          reviewOptions.apiKey = process.env.OPENAI_API_KEY;
        }
        if (process.env.OPENAI_MODEL) {
          reviewOptions.model = process.env.OPENAI_MODEL;
        }
        if (body.context) {
          reviewOptions.context = body.context as ReviewSupplementalContext;
        }
        const review = await reviewDraftPlan(body.plan, reviewOptions);
        sendJson(response, 200, review, requestOrigin);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/approve') {
        const body = approvalRequestSchema.parse(await readJson(request));
        sendJson(response, 200, approvePlan(body), requestOrigin);
        return;
      }

      if (request.method === 'PUT' && projectId) {
        const body = await readJson(request);
        const identifier = z.object({ projectId: z.string().min(1) }).safeParse(body);
        if (!identifier.success) {
          throw new ZodError(identifier.error.issues);
        }
        const requestProjectId = identifier.data.projectId;
        if (requestProjectId !== projectId) {
          sendJson(response, 400, {
            error: 'Project id does not match request path',
            projectId,
          }, requestOrigin);
          return;
        }

        sendJson(response, 200, await projectRepository.save(projectId, body as Parameters<typeof projectRepository.save>[1]), requestOrigin);
        return;
      }

      sendJson(response, 404, {
        error: 'Not found',
        path: url.pathname,
      }, requestOrigin);
    } catch (error) {
      if (error instanceof ZodError) {
        sendJson(response, 400, {
          error: 'Validation failed',
          issues: error.issues,
        }, request.headers.origin);
        return;
      }

      if (error instanceof Error && error.name === 'SyntaxError') {
        sendJson(response, 400, {
          error: 'Invalid JSON payload',
        }, request.headers.origin);
        return;
      }

      const message = error instanceof Error ? error.message : 'Unexpected server error';
      sendJson(response, 500, {
        error: message,
      }, request.headers.origin);
    }
  });

  return {
    port: options.port ?? defaultPort,
    server,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, port } = createCamApiServer();
  server.listen(port, () => {
    console.log(`CAM API listening on http://localhost:${port}`);
  });
}
