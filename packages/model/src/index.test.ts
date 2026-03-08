import { describe, expect, it } from 'vitest';
import { samplePartInput } from '@cam/shared';
import { createModelSource, deriveImportedModelFromPart, deriveOperationPreviews } from './index.js';

describe('@cam/model', () => {
  it('derives stable model entities from structured part input', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
      sourceGeometryMetadata: ['Structured JSON source'],
    });

    const model = deriveImportedModelFromPart(source, samplePartInput);
    const firstFeature = model.entities.find((entity) => entity.featureId);

    expect(model.status).toBe('derived');
    expect(model.entities[0]?.kind).toBe('stock');
    expect(firstFeature?.id).toContain('entity-feature-');
    expect(model.featureGeometryLinks[0]?.featureId).toBe(firstFeature?.featureId);
    expect(model.sourceGeometryMetadata.join(' ')).toContain('Geometry remains derived metadata');
  });

  it('derives operation previews tied to operation ids and feature ids', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const model = deriveImportedModelFromPart(source, samplePartInput);
    const previews = deriveOperationPreviews(model, [
      {
        id: 'op-profile-1',
        name: 'Profile outer',
        kind: 'profile',
        featureId: model.featureGeometryLinks.find((link) => link.featureId.startsWith('contour'))?.featureId ?? 'contour-1',
        toolId: 'tool-flat-10',
        toolName: '10 mm flat end mill',
        setupId: 'setup-1',
        setup: 'Setup 1 / Top side',
        strategy: 'Derived profile pass',
        notes: '',
        estimatedMinutes: 2,
        enabled: true,
        origin: 'automatic',
        order: 0,
        isDirty: false,
      },
    ]);

    expect(previews).toHaveLength(1);
    expect(previews[0]?.id).toBe('preview-op-profile-1');
    expect(previews[0]?.operationId).toBe('op-profile-1');
    expect(previews[0]?.kind).toBe('contour_path');
  });
});
