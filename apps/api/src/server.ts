import { createServer } from 'node:http';
import { reviewDraftPlan } from '@cam/ai';
import { approvePlan, planPart, samplePartInput } from '@cam/engine';
import { approvalRequestSchema, partInputSchema, reviewRequestSchema } from '@cam/shared';
import { ZodError } from 'zod';

const port = Number(process.env.PORT ?? 3001);

function sendJson(response: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'cam-api',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/sample') {
      sendJson(response, 200, samplePartInput);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/plan') {
      const body = partInputSchema.parse(await readJson(request));
      sendJson(response, 200, planPart(body));
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
      sendJson(response, 200, review);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/approve') {
      const body = approvalRequestSchema.parse(await readJson(request));
      sendJson(response, 200, approvePlan(body));
      return;
    }

    sendJson(response, 404, {
      error: 'Not found',
      path: url.pathname,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, {
        error: 'Validation failed',
        issues: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.name === 'SyntaxError') {
      sendJson(response, 400, {
        error: 'Invalid JSON payload',
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error';
    sendJson(response, 500, {
      error: message,
    });
  }
});

server.listen(port, () => {
  console.log(`CAM API listening on http://localhost:${port}`);
});
