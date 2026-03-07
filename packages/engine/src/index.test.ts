import { describe, expect, it } from 'vitest';
import { partInputSchema, samplePartInput } from '@cam/shared';
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
});
