import { describe, expect, it } from 'vitest';
import { buildGeometryGraph, parseDxfGeometry2D } from '@cam/geometry2d';
import { extractGeometryFeatures, planPart } from '@cam/engine';
import { samplePartInput } from '@cam/shared';
import {
  buildNativeWorkbenchSnapshot,
  buildProjectRevisionRecord,
  createModelSource,
  deriveImportedModelFromGeometry,
  deriveImportedModelFromPart,
  deriveOperationPreviews,
} from './index.js';

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
        source: 'generated',
        order: 0,
        isDirty: false,
        depthProfile: {
          setupPlane: {
            id: 'setup-plane-top',
            label: 'Top setup plane',
            orientation: 'top',
          },
          stockTop: {
            reference: {
              id: 'stock-top',
              kind: 'stock_top',
              label: 'Stock top',
              zMm: 0,
            },
            zMm: 0,
          },
          floorLevel: {
            reference: {
              id: 'floor-level',
              kind: 'feature_floor',
              label: 'Outer profile floor',
              zMm: -8,
            },
            zMm: -8,
          },
          depthRange: {
            topZMm: 0,
            bottomZMm: -8,
          },
          targetDepthMm: 8,
          depthStatus: 'assumed',
          bottomReference: {
            reference: {
              id: 'bottom-reference',
              kind: 'feature_floor',
              label: 'Outer profile floor',
              zMm: -8,
            },
            source: 'assumed',
            behavior: 'through',
          },
          passDepthPlan: {
            roughingLayerCount: 3,
            maxStepDownMm: 3,
            finishPass: 'profile_cleanup',
            retractTo: 'retract_plane',
            note: 'Preview-only pass plan.',
          },
          fieldSources: {
            targetDepth: 'assumed',
            bottomBehavior: 'assumed',
            passDepthPlan: 'generated',
          },
          assumptions: [
            {
              id: 'depth-assumed',
              label: 'Depth assumed from 2D source',
              description: 'Preview only.',
              source: 'import_default',
              reviewRequired: true,
            },
          ],
          warnings: [],
        },
      },
    ]);

    expect(previews).toHaveLength(1);
    expect(previews[0]?.id).toBe('preview-op-profile-1');
    expect(previews[0]?.operationId).toBe('op-profile-1');
    expect(previews[0]?.kind).toBe('contour_path');
    expect(previews[0]?.paths[0]?.segments.length).toBeGreaterThan(0);
    expect(previews[0]?.source).toBe('generated');
    expect(previews[0]?.depthAnnotations[0]).toContain('Target depth');
    expect(previews[0]?.depthAnnotations.some((annotation) => annotation.includes('Depth assumed'))).toBe(true);
    expect(previews[0]?.depthAnnotations.some((annotation) => annotation.includes('Bottom behavior'))).toBe(true);
    expect(previews[0]?.paths[0]?.segments[0]?.depthAnnotation).toContain('Z 8.0 mm');
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

  it('derives path-plan-aware previews from generated operations', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const model = deriveImportedModelFromPart(source, samplePartInput);
    const plan = planPart(samplePartInput);
    const contourPreview = deriveOperationPreviews(model, plan.operations).find((preview) => preview.kind === 'contour_path')!;

    expect(contourPreview.pathPreviewMode).toBe('full_path_plan');
    expect(contourPreview.pathProfile?.pathPlans.length).toBeGreaterThan(0);
    expect(contourPreview.paths[0]?.segments.some((segment) => segment.motionType === 'rapid_move')).toBe(true);
    expect(contourPreview.depthAnnotations.some((annotation) => annotation.includes('deterministic path candidate'))).toBe(true);
  });

  it('builds a native workbench snapshot that links model, features, operations, tools, and previews', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const model = deriveImportedModelFromPart(source, samplePartInput);
    const plan = planPart(samplePartInput);
    const projectId = `${plan.part.partId}-${plan.part.revision}`;
    const project = {
      projectId,
      revision: 1,
      sourceImportId: source.id,
      sourceType: source.type,
      sourceFilename: source.filename,
      derivedModel: model,
      planMetadata: {
        featureCount: plan.summary.featureCount,
        operationCount: plan.summary.operationCount,
        enabledOperationCount: plan.summary.enabledOperationCount,
        manualOperationCount: plan.summary.manualOperationCount,
        estimatedCycleTimeMinutes: plan.estimatedCycleTimeMinutes,
        highestRisk: plan.summary.highestRisk,
      },
      approvalState: plan.approval.state,
      updatedAt: new Date().toISOString(),
      warnings: [],
      plan,
      revisions: [buildProjectRevisionRecord(projectId, 1, plan, source.id)],
    };

    const snapshot = buildNativeWorkbenchSnapshot(project);

    expect(snapshot.schemaVersion).toBe('native-workbench-v1');
    expect(snapshot.projectId).toBe(projectId);
    expect(snapshot.metadata.featureCount).toBe(plan.features.length);
    expect(snapshot.metadata.resolvedLinkCount + snapshot.metadata.partialLinkCount).toBeGreaterThan(0);
    expect(snapshot.nodes.some((node) => node.kind === 'collection' && node.label === 'Model tree')).toBe(true);
    expect(snapshot.nodes.some((node) => node.kind === 'operation' && node.operationId === plan.operations[0]?.id)).toBe(true);
    expect(snapshot.nodes.some((node) => node.kind === 'tool' && node.toolId === plan.operations[0]?.toolId)).toBe(true);
    expect(snapshot.nodes.some((node) => node.kind === 'operation_preview')).toBe(true);
    expect(snapshot.selectionLinks.some((link) => link.operationNodeId && link.previewNodeId)).toBe(true);
    expect(snapshot.linkMappings.some((mapping) => mapping.resolution === 'partial' || mapping.resolution === 'resolved')).toBe(true);
    expect(snapshot.displayLayers.some((layer) => layer.kind === 'path_plan')).toBe(true);
    expect(snapshot.displayLayers.some((layer) => layer.kind === 'inspection')).toBe(true);
  });

  it('marks native workbench link mappings as partial when operation references cannot be fully matched', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const model = deriveImportedModelFromPart(source, samplePartInput);
    const plan = planPart(samplePartInput);
    const firstOperation = plan.operations[0]!;
    const brokenPlan = {
      ...plan,
      operations: [
        {
          ...firstOperation,
          featureId: 'missing-feature',
          toolId: 'missing-tool',
          warnings: [...firstOperation.warnings, 'Synthetic missing-link coverage'],
        },
        ...plan.operations.slice(1),
      ],
    };
    const projectId = `${plan.part.partId}-${plan.part.revision}-broken-links`;
    const project = {
      projectId,
      revision: 1,
      sourceImportId: source.id,
      sourceType: source.type,
      sourceFilename: source.filename,
      derivedModel: model,
      planMetadata: {
        featureCount: brokenPlan.summary.featureCount,
        operationCount: brokenPlan.summary.operationCount,
        enabledOperationCount: brokenPlan.summary.enabledOperationCount,
        manualOperationCount: brokenPlan.summary.manualOperationCount,
        estimatedCycleTimeMinutes: brokenPlan.estimatedCycleTimeMinutes,
        highestRisk: brokenPlan.summary.highestRisk,
      },
      approvalState: brokenPlan.approval.state,
      updatedAt: new Date().toISOString(),
      warnings: [],
      plan: brokenPlan,
      revisions: [buildProjectRevisionRecord(projectId, 1, brokenPlan, source.id)],
    };

    const snapshot = buildNativeWorkbenchSnapshot(project);
    const brokenLink = snapshot.linkMappings.find((mapping) => mapping.operationId === firstOperation.id);

    expect(brokenLink?.resolution).toBe('partial');
    expect(brokenLink?.warnings.some((warning) => warning.includes('no model-entity link'))).toBe(true);
    expect(snapshot.metadata.partialLinkCount).toBeGreaterThan(0);
    expect(snapshot.selectionLinks.some((link) => link.resolution === 'partial' && link.warnings.some((warning) => warning.includes('no model-entity link')))).toBe(true);
  });
});
