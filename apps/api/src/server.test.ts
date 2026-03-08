import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planPart, samplePartInput } from '@cam/engine';
import { createFileProjectRepository } from './draft-store.js';
import { createCamApiServer } from './server.js';

async function startTestServer() {
  const directory = await mkdtemp(join(tmpdir(), 'cam-api-test-'));
  const { server } = createCamApiServer({
    port: 0,
    projectRepository: createFileProjectRepository(directory),
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
  it('lists, saves, and loads projects', async () => {
    const instance = await startTestServer();
    servers.push(instance);

    const plan = planPart(samplePartInput);
    const projectId = `${plan.part.partId}-${plan.part.revision}`;

    const saveResponse = await fetch(`${instance.baseUrl}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        plan,
      }),
    });

    expect(saveResponse.ok).toBe(true);
    const savedProject = await saveResponse.json();
    expect(savedProject.metadata.projectId).toBe(projectId);
    expect(savedProject.metadata.approvalState).toBe(plan.approval.state);

    const listResponse = await fetch(`${instance.baseUrl}/projects`);
    const listPayload = await listResponse.json();
    expect(listPayload.projects).toHaveLength(1);
    expect(listPayload.projects[0].projectId).toBe(projectId);

    const loadResponse = await fetch(`${instance.baseUrl}/projects/${projectId}`);
    const loadedProject = await loadResponse.json();
    expect(loadedProject.projectId).toBe(projectId);
    expect(loadedProject.plan.operations).toHaveLength(plan.operations.length);

    const legacyLoadResponse = await fetch(`${instance.baseUrl}/drafts/${projectId}`);
    expect(legacyLoadResponse.ok).toBe(true);
  });
});
