import { describe, expect, it } from 'vitest';
import { planPart, samplePartInput } from '@cam/engine';
import { createModelSource, deriveImportedModelFromPart } from '@cam/model';
import { buildOperationPreviewLayer, buildScenePipeline } from './viewportScene.js';

describe('viewportScene', () => {
  it('builds feature and operation preview layers from the imported model', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const model = deriveImportedModelFromPart(source, samplePartInput);
    const plan = planPart(samplePartInput);
    const previews = buildOperationPreviewLayer(model, plan.operations);
    const scene = buildScenePipeline(model, previews, plan.features[0]?.id ?? null, plan.operations[0]?.id ?? null);

    expect(scene.stockEntity?.kind).toBe('stock');
    expect(scene.featureLayer.entities.length).toBeGreaterThan(0);
    expect(scene.operationPreviewLayer.previews.length).toBe(plan.operations.length);
    expect(scene.disclaimer).toContain('operation preview');
  });
});
