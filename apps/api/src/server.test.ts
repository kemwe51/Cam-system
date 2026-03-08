import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planPart, samplePartInput } from '@cam/engine';
import { createFileImportSessionRepository, createFileProjectRepository } from './draft-store.js';
import { createCamApiServer } from './server.js';

async function startTestServer() {
  const directory = await mkdtemp(join(tmpdir(), 'cam-api-test-'));
  const { server } = createCamApiServer({
    port: 0,
    projectRepository: createFileProjectRepository(directory),
    importSessionRepository: createFileImportSessionRepository(directory),
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP server address.');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    directory,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await rm(directory, { recursive: true, force: true });
    },
  };
}

const servers: Array<{ close: () => Promise<void> }> = [];

afterAll(async () => {
  await Promise.all(servers.map((entry) => entry.close()));
});

describe('CAM API server', () => {
  it('creates import sessions and saves project records with source metadata', async () => {
    const instance = await startTestServer();
    servers.push(instance);

    const importResponse = await fetch(`${instance.baseUrl}/imports/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useSample: true,
        fileName: 'sample.json',
      }),
    });

    expect(importResponse.status).toBe(201);
    const importSession = await importResponse.json();
    expect(importSession.importStatus).toBe('success');
    expect(importSession.source.filename).toBe('sample.json');
    expect(importSession.importedModel.status).toBe('derived');

    const loadImportResponse = await fetch(`${instance.baseUrl}/imports/${importSession.id}`);
    expect(loadImportResponse.ok).toBe(true);

    const plan = planPart(importSession.deterministicPartInput ?? samplePartInput);
    const projectId = `${plan.part.partId}-${plan.part.revision}`;

    const saveResponse = await fetch(`${instance.baseUrl}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        revision: 0,
        sourceImportId: importSession.id,
        sourceType: importSession.source.type,
        sourceFilename: importSession.source.filename,
        derivedModel: importSession.importedModel,
        approvalState: plan.approval.state,
        updatedAt: new Date().toISOString(),
        warnings: importSession.warnings,
        plan,
        revisions: [],
      }),
    });

    expect(saveResponse.ok).toBe(true);
    const savedProject = await saveResponse.json();
    expect(savedProject.projectId).toBe(projectId);
    expect(savedProject.revision).toBe(1);
    expect(savedProject.sourceImportId).toBe(importSession.id);
    expect(savedProject.revisions).toHaveLength(1);

    const listResponse = await fetch(`${instance.baseUrl}/projects`);
    const listPayload = await listResponse.json();
    expect(listPayload.projects).toHaveLength(1);
    expect(listPayload.projects[0].sourceType).toBe('json');

    const loadResponse = await fetch(`${instance.baseUrl}/projects/${projectId}`);
    const loadedProject = await loadResponse.json();
    expect(loadedProject.sourceFilename).toBe('sample.json');
    expect(loadedProject.plan.operations).toHaveLength(plan.operations.length);

    const legacyLoadResponse = await fetch(`${instance.baseUrl}/drafts/${projectId}`);
    expect(legacyLoadResponse.ok).toBe(true);
  });

  it('returns honest placeholder import sessions for DXF routes', async () => {
    const instance = await startTestServer();
    servers.push(instance);

    const response = await fetch(`${instance.baseUrl}/imports/dxf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'incoming-part.dxf',
      }),
    });

    expect(response.status).toBe(201);
    const importSession = await response.json();
    expect(importSession.importStatus).toBe('not_implemented');
    expect(importSession.source.type).toBe('dxf');
    expect(importSession.warnings.join(' ')).toContain('not implemented yet');
  });
});
