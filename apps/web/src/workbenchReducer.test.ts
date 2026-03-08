import { describe, expect, it } from 'vitest';
import { planPart, samplePartInput } from '@cam/engine';
import { initialWorkbenchState, buildProjectDraft, workbenchReducer } from './workbenchReducer.js';

function stateWithPlan() {
  const plan = planPart(samplePartInput);
  return workbenchReducer(initialWorkbenchState, {
    type: 'planLoaded',
    plan,
    message: 'loaded',
  });
}

describe('workbenchReducer', () => {
  it('reorders operations and keeps sequential order values', () => {
    const state = stateWithPlan();
    const firstOperation = state.draftPlan?.operations[0];
    expect(firstOperation).toBeDefined();

    const nextState = workbenchReducer(state, {
      type: 'moveOperation',
      operationId: firstOperation!.id,
      direction: 'down',
      message: 'move',
    });

    expect(nextState.draftPlan?.operations[1]?.id).toBe(firstOperation!.id);
    expect(nextState.draftPlan?.operations.map((operation) => operation.order)).toEqual(
      nextState.draftPlan?.operations.map((_, index) => index),
    );
  });

  it('toggles operation enablement and marks the plan dirty', () => {
    const state = stateWithPlan();
    const operation = state.draftPlan!.operations[0]!;

    const nextState = workbenchReducer(state, {
      type: 'toggleOperation',
      operationId: operation.id,
      message: 'toggle',
    });

    expect(nextState.draftPlan?.operations[0]?.enabled).toBe(false);
    expect(nextState.draftPlan?.operations[0]?.isDirty).toBe(true);
    expect(nextState.dirty).toBe(true);
  });

  it('creates, duplicates, and deletes manual operations', () => {
    const state = stateWithPlan();
    const featureId = state.draftPlan!.features[0]!.id;

    const withManual = workbenchReducer(state, {
      type: 'addManualOperation',
      featureId,
      message: 'add manual',
    });

    const manual = withManual.draftPlan!.operations.find((operation) => operation.origin === 'manual');
    expect(manual).toBeDefined();

    const duplicated = workbenchReducer(withManual, {
      type: 'duplicateOperation',
      operationId: manual!.id,
      message: 'duplicate',
    });
    expect(duplicated.draftPlan?.operations.filter((operation) => operation.origin === 'manual')).toHaveLength(2);

    const deleted = workbenchReducer(duplicated, {
      type: 'deleteManualOperation',
      operationId: manual!.id,
      message: 'delete',
    });
    expect(deleted.draftPlan?.operations.filter((operation) => operation.origin === 'manual')).toHaveLength(1);
  });

  it('builds project drafts and clears per-operation dirty state after save/load', () => {
    const state = stateWithPlan();
    const edited = workbenchReducer(state, {
      type: 'updateOperation',
      operationId: state.draftPlan!.operations[0]!.id,
      changes: { notes: 'Programmer override' },
      message: 'edit',
    });

    const projectDraft = buildProjectDraft(edited);
    expect(projectDraft?.metadata?.partId).toBe(samplePartInput.partId);
    expect(projectDraft?.plan.operations[0]?.isDirty).toBe(false);

    const loaded = workbenchReducer(edited, {
      type: 'projectLoaded',
      project: projectDraft!,
      message: 'load',
    });

    expect(loaded.dirty).toBe(false);
    expect(loaded.lastSavedAt).toBe(projectDraft?.savedAt ?? null);
    expect(loaded.draftPlan?.operations.every((operation) => operation.isDirty === false)).toBe(true);
  });
});
