import { describe, expect, it } from 'vitest';
import { partInputSchema, projectDraftSchema, samplePartInput } from '@cam/shared';
import { approvePlan, planPart } from './index.js';

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
});
