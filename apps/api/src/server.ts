import { createServer } from 'node:http';
import { reviewDraftPlan } from '@cam/ai';
import { approvePlan, planPart, samplePartInput } from '@cam/engine';
import {
  approvalRequestSchema,
  partInputSchema,
  projectDraftSchema,
  reviewRequestSchema,
} from '@cam/shared';
import { ZodError } from 'zod';
import { createJsonDraftStore } from './draft-store.js';

const port = Number(process.env.PORT ?? 3001);
const draftStore = createJsonDraftStore();

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

function matchDraftRoute(pathname: string): string | null {
  const match = /^\/drafts\/([^/]+)$/.exec(pathname);
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

    const draftProjectId = matchDraftRoute(url.pathname);
    if (request.method === 'GET' && draftProjectId) {
      const draft = await draftStore.load(draftProjectId);
      if (!draft) {
        sendJson(response, 404, {
          error: 'Draft not found',
          projectId: draftProjectId,
        }, requestOrigin);
        return;
      }

      sendJson(response, 200, draft, requestOrigin);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/plan') {
      const body = partInputSchema.parse(await readJson(request));
      sendJson(response, 200, planPart(body), requestOrigin);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/review') {
      const body = reviewRequestSchema.parse(await readJson(request));
      const reviewOptions = {
        ...(process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY } : {}),
        ...(process.env.OPENAI_MODEL ? { model: process.env.OPENAI_MODEL } : {}),
      };
      const review = await reviewDraftPlan(body.plan, {
        ...reviewOptions,
      });
      sendJson(response, 200, review, requestOrigin);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/approve') {
      const body = approvalRequestSchema.parse(await readJson(request));
      sendJson(response, 200, approvePlan(body), requestOrigin);
      return;
    }

    if (request.method === 'PUT' && draftProjectId) {
      const body = projectDraftSchema.parse(await readJson(request));
      if (body.projectId !== draftProjectId) {
        sendJson(response, 400, {
          error: 'Draft project id does not match request path',
          projectId: draftProjectId,
        }, requestOrigin);
        return;
      }

      sendJson(response, 200, await draftStore.save(draftProjectId, body), requestOrigin);
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

server.listen(port, () => {
  console.log(`CAM API listening on http://localhost:${port}`);
});
