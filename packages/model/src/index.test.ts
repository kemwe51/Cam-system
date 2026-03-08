import { describe, expect, it } from 'vitest';
import { buildGeometryGraph, parseDxfGeometry2D } from '@cam/geometry2d';
import { extractGeometryFeatures } from '@cam/engine';
import { samplePartInput } from '@cam/shared';
import { createModelSource, deriveImportedModelFromGeometry, deriveImportedModelFromPart, deriveOperationPreviews } from './index.js';

const dxfFixture = `0
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

  it('derives imported geometry, extracted features, and links from DXF-backed geometry documents', () => {
    const source = createModelSource({
      id: 'import-dxf-sample',
      type: 'dxf',
      filename: 'sample.dxf',
      mediaType: 'application/dxf',
    });
    const document = parseDxfGeometry2D(dxfFixture, 'fixture');
    const graph = buildGeometryGraph(document, 0.01);
    const extraction = extractGeometryFeatures(document, graph);
    const model = deriveImportedModelFromGeometry(
      source,
      document,
      graph,
      extraction.features.map((feature) => ({
        id: feature.id,
        label: feature.label,
        kind: feature.kind,
        mappedFeatureId: feature.plannedFeatureId,
        sourceGeometryRefs: feature.sourceGeometryRefs,
        confidence: feature.confidence,
        inferenceMethod: feature.inferenceMethod,
        warnings: feature.warnings,
        bounds: feature.bounds,
        classificationState: 'automatic',
      })),
      extraction.partInput,
      extraction.warnings,
    );

    expect(model.geometryDocument?.entities.length).toBeGreaterThan(0);
    expect(model.geometryGraph?.closedProfileIds.length).toBeGreaterThan(0);
    expect(model.extractedFeatures.some((feature) => feature.kind === 'outside_contour')).toBe(true);
    expect(model.featureGeometryLinks.some((link) => link.sourceGeometryIds.length > 0)).toBe(true);
  });
});
