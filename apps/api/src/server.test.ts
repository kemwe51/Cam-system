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
const sampleDxf = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
OUTER
90
4
70
1
10
0
20
0
10
80
20
0
10
80
20
50
10
0
20
50
0
CIRCLE
8
HOLES
10
30
20
20
40
4
0
ENDSEC
0
EOF`;

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
    plan.operations = plan.operations.map((operation) => operation.kind === 'pocket'
      ? {
          ...operation,
          source: 'edited',
          depthProfile: operation.depthProfile
            ? {
                ...operation.depthProfile,
                targetDepthMm: 11.5,
                fieldSources: {
                  ...operation.depthProfile.fieldSources,
                  targetDepth: 'manual_override',
                },
              }
            : operation.depthProfile,
        }
      : operation);
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
    expect(loadedProject.plan.features[0].depthModel.setupPlane.label).toBe('Top setup plane');
    expect(loadedProject.plan.operations[1].depthProfile.targetDepthMm).toBeGreaterThan(0);
    expect(loadedProject.plan.operations.some((operation) => operation.depthProfile?.fieldSources?.targetDepth === 'manual_override')).toBe(true);
    expect(loadedProject.plan.setups[0].workOffsetDefinition.code).toBe('G54');
    expect(loadedProject.plan.operations.some((operation) => operation.pathProfile?.pathPlans.length)).toBe(true);
    expect(loadedProject.plan.operations.some((operation) => operation.pathProfile?.workOffset?.code === 'G54')).toBe(true);

    const legacyLoadResponse = await fetch(`${instance.baseUrl}/drafts/${projectId}`);
    expect(legacyLoadResponse.ok).toBe(true);
  });

  it('creates DXF import sessions with geometry, extracted features, and draftable deterministic input', async () => {
    const instance = await startTestServer();
    servers.push(instance);

    const response = await fetch(`${instance.baseUrl}/imports/dxf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'incoming-part.dxf',
        content: sampleDxf,
      }),
    });

    expect(response.status).toBe(201);
    const importSession = await response.json();
    expect(importSession.importStatus).toBe('success');
    expect(importSession.source.type).toBe('dxf');
    expect(importSession.importedModel.geometryDocument.entities.length).toBeGreaterThan(0);
    expect(importSession.importedModel.extractedFeatures.length).toBeGreaterThan(0);
    expect(importSession.deterministicPartInput.contours.length).toBeGreaterThan(0);
    expect(importSession.warnings.join(' ')).toContain('feature depths are assumed planning defaults');

    const generateResponse = await fetch(`${instance.baseUrl}/operations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importSession.deterministicPartInput),
    });
    expect(generateResponse.ok).toBe(true);
    const generatedPlan = await generateResponse.json();
    expect(generatedPlan.operations.length).toBeGreaterThan(0);

    const regenerateResponse = await fetch(`${instance.baseUrl}/operations/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: generatedPlan,
        preserveFrozenEdited: true,
      }),
    });
    expect(regenerateResponse.ok).toBe(true);
    const regeneratedPlan = await regenerateResponse.json();
    expect(regeneratedPlan.approval.notes.join(' ')).toContain('regenerated');
  });
});
