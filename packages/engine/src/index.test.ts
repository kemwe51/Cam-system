import { describe, expect, it } from 'vitest';
import { buildGeometryGraph, parseDxfGeometry2D } from '@cam/geometry2d';
import { partInputSchema, projectDraftSchema, samplePartInput } from '@cam/shared';
import { approvePlan, extractGeometryFeatures, planPart, regenerateDraftPlan } from './index.js';

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
LWPOLYLINE
8
SLOT
90
4
70
1
10
10
20
20
10
60
20
20
10
60
20
28
10
10
20
28
0
CIRCLE
8
HOLES
10
30
20
35
40
3
0
LINE
8
SCRIBE
10
0
20
60
11
20
21
65
0
ENDSEC
0
EOF`;

describe('planPart', () => {
  it('builds a deterministic plan for the sample part input', () => {
    const plan = planPart(samplePartInput);

    expect(plan.features).toHaveLength(7);
    expect(plan.operations.map((operation) => operation.kind)).toEqual([
      'face',
      'drill',
      'pocket',
      'pocket',
      'slot',
      'profile',
      'profile',
      'chamfer',
      'engrave',
    ]);
    expect(plan.operations[1]?.name).toContain('Drill');
    expect(plan.operations.filter((operation) => operation.kind === 'profile')).toHaveLength(2);
    expect(plan.operations.every((operation) => operation.source === (operation.origin === 'manual' ? 'manual' : 'generated'))).toBe(true);
    expect(plan.summary.highestRisk).toBe('high');
    expect(plan.approval.requiresHumanApproval).toBe(true);
    expect(plan.estimatedCycleTimeMinutes).toBeGreaterThan(0);
    expect(plan.operations.every((operation) => operation.enabled)).toBe(true);
    expect(plan.operations.every((operation) => operation.origin === 'automatic')).toBe(true);
    expect(plan.operations.map((operation) => operation.order)).toEqual(
      plan.operations.map((_, index) => index),
    );
    expect(plan.features.every((feature) => feature.depthModel?.setupPlane.label === 'Top setup plane')).toBe(true);
    expect(plan.operations.every((operation) => operation.depthProfile?.setupPlane.label === 'Top setup plane')).toBe(true);
  });

  it('flags deep pockets and narrow slots as review risks', () => {
    const plan = planPart(samplePartInput);
    const titles = plan.risks.map((risk) => risk.title);

    expect(titles).toContain('Deep pocket needs reach review');
    expect(titles).toContain('Narrow slot limits tooling');
  });

  it('keeps depth assumptions explicit for inferred 2D geometry features and operations', () => {
    const extraction = extractGeometryFeatures(parseDxfGeometry2D(dxfFixture, 'fixture'));
    const plan = planPart(extraction.partInput);
    const inferredFeature = plan.features.find((feature) => feature.origin === 'geometry_inferred' && feature.depthMm > 0);
    const inferredOperation = inferredFeature
      ? plan.operations.find((operation) => operation.featureId === inferredFeature.id)
      : undefined;

    expect(inferredFeature?.depthModel?.assumptions[0]?.source).toBe('import_default');
    expect(inferredFeature?.depthModel?.warnings[0]?.code).toBe('depth_assumed_from_2d');
    expect(inferredFeature?.depthModel?.depthStatus).toBe('assumed');
    expect(inferredOperation?.depthProfile?.assumptions[0]?.label).toContain('Depth assumed');
    expect(inferredOperation?.depthProfile?.floorLevel?.zMm).toBeLessThan(0);
    expect(inferredOperation?.depthProfile?.bottomReference?.behavior).toBeDefined();
  });

  it('adds depth-aware pass planning and tool-class selection details to generated operations', () => {
    const plan = planPart(samplePartInput);
    const slotOperation = plan.operations.find((operation) => operation.kind === 'slot');
    const pocketOperation = plan.operations.find((operation) => operation.kind === 'pocket' && operation.name.includes('Finish'));

    expect(slotOperation?.toolClass).toBe('small_slot_end_mill');
    expect(slotOperation?.toolSelectionReason?.ruleId).toBe('tool-rule-slot-narrow');
    expect(slotOperation?.depthProfile?.passDepthPlan?.roughingLayerCount).toBeGreaterThan(0);
    expect(slotOperation?.depthProfile?.fieldSources?.targetDepth).toBe('generated');
    expect(pocketOperation?.depthProfile?.passDepthPlan?.finishPass).toBe('wall_and_floor');
  });

  it('marks approved plans with reviewer information', () => {
    const approved = approvePlan({
      plan: planPart(samplePartInput),
      approver: 'NC Programmer',
      notes: 'Reviewed on the sample bracket flow.',
    });

    expect(approved.approval.state).toBe('approved');
    expect(approved.approval.approvedBy).toBe('NC Programmer');
    expect(approved.approval.notes).toContain('Reviewed on the sample bracket flow.');
    expect(() => partInputSchema.parse(approved.part)).not.toThrow();
  });

  it('validates persisted project drafts with selected workbench state', () => {
    const plan = planPart(samplePartInput);
    const projectDraft = projectDraftSchema.parse({
      projectId: `${plan.part.partId}-${plan.part.revision}`,
      plan,
      selectedEntity: {
        type: 'feature',
        id: plan.features[0]!.id,
      },
      savedAt: new Date().toISOString(),
    });

    expect(projectDraft.projectId).toBe('demo-bracket-001-A');
    expect(projectDraft.plan.operations[0]?.enabled).toBe(true);
    expect(projectDraft.selectedEntity?.type).toBe('feature');
  });

  it('extracts contour, slot, hole, and open-profile warnings from DXF-derived geometry', () => {
    const document = parseDxfGeometry2D(dxfFixture, 'fixture');
    const graph = buildGeometryGraph(document, 0.01);
    const extraction = extractGeometryFeatures(document, graph);

    expect(extraction.features.some((feature) => feature.kind === 'outside_contour')).toBe(true);
    expect(extraction.features.some((feature) => feature.kind === 'slot')).toBe(true);
    expect(extraction.features.some((feature) => feature.kind === 'hole_group')).toBe(true);
    expect(extraction.graph.openProfileIds.length).toBe(1);
    expect(extraction.warnings.join(' ')).toContain('unclassified');
    expect(() => partInputSchema.parse(extraction.partInput)).not.toThrow();
  });

  it('groups matching circles into grouped hole operations and regenerates after feature reclassification', () => {
    const groupedCircleDxf = `0
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
100
20
0
10
100
20
60
10
0
20
60
0
CIRCLE
8
HOLES
10
20
20
20
40
3
0
CIRCLE
8
HOLES
10
80
20
20
40
3
0
ENDSEC
0
EOF`;
    const extraction = extractGeometryFeatures(parseDxfGeometry2D(groupedCircleDxf, 'holes'));
    expect(extraction.partInput.holeGroups).toHaveLength(1);
    expect(extraction.partInput.holeGroups[0]?.count).toBe(2);

    const initialPlan = planPart(extraction.partInput);
    expect(initialPlan.operations.filter((operation) => operation.kind === 'drill')).toHaveLength(1);

    const featureId = initialPlan.features.find((feature) => feature.kind === 'hole_group')!.id;
    const reclassified = initialPlan.features.map((feature) => feature.id === featureId
      ? { ...feature, kind: 'slot' as const, classificationState: 'manual_override' as const }
      : feature);
    const regenerated = regenerateDraftPlan({
      ...initialPlan,
      features: reclassified,
    });

    expect(regenerated.features.find((feature) => feature.id === featureId)?.kind).toBe('slot');
    expect(regenerated.operations.some((operation) => operation.featureId === featureId && operation.kind === 'slot')).toBe(true);
  });

  it('preserves manual depth overrides on regenerated operations without freezing the whole operation', () => {
    const plan = planPart(samplePartInput);
    const operation = plan.operations.find((entry) => entry.kind === 'pocket' && entry.name.includes('Rough'))!;
    const updatedPlan = {
      ...plan,
      operations: plan.operations.map((entry) => entry.id === operation.id
        ? {
            ...entry,
            source: 'edited' as const,
            depthProfile: {
              ...entry.depthProfile!,
              targetDepthMm: 9.5,
              fieldSources: {
                ...entry.depthProfile!.fieldSources,
                targetDepth: 'manual_override' as const,
              },
            },
          }
        : entry),
    };

    const regenerated = regenerateDraftPlan(updatedPlan, {
      selectedFeatureIds: [operation.featureId],
      preserveFrozenEdited: true,
    });
    const regeneratedOperation = regenerated.operations.find((entry) => entry.id === operation.id)!;

    expect(regeneratedOperation.depthProfile?.targetDepthMm).toBe(9.5);
    expect(regeneratedOperation.depthProfile?.fieldSources?.targetDepth).toBe('manual_override');
    expect(regeneratedOperation.depthProfile?.overridePreserved).toBe(true);
    expect(regeneratedOperation.source).toBe('edited');
  });
});
