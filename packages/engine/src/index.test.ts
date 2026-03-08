import { describe, expect, it } from 'vitest';
import { buildGeometryGraph, parseDxfGeometry2D } from '@cam/geometry2d';
import { partInputSchema, projectDraftSchema, samplePartInput } from '@cam/shared';
import { approvePlan, extractGeometryFeatures, planPart } from './index.js';

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
      'profile',
      'pocket',
      'pocket',
      'slot',
      'drill',
      'chamfer',
      'engrave',
    ]);
    expect(plan.summary.highestRisk).toBe('high');
    expect(plan.approval.requiresHumanApproval).toBe(true);
    expect(plan.estimatedCycleTimeMinutes).toBeGreaterThan(0);
    expect(plan.operations.every((operation) => operation.enabled)).toBe(true);
    expect(plan.operations.every((operation) => operation.origin === 'automatic')).toBe(true);
    expect(plan.operations.map((operation) => operation.order)).toEqual(
      plan.operations.map((_, index) => index),
    );
  });

  it('flags deep pockets and narrow slots as review risks', () => {
    const plan = planPart(samplePartInput);
    const titles = plan.risks.map((risk) => risk.title);

    expect(titles).toContain('Deep pocket needs reach review');
    expect(titles).toContain('Narrow slot limits tooling');
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
});
