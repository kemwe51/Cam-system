import { describe, expect, it } from 'vitest';
import { planPart, samplePartInput } from '@cam/engine';
import { createModelSource, deriveImportedModelFromPart } from '@cam/model';
import { initialWorkbenchState, buildProjectRecord, workbenchReducer } from './workbenchReducer.js';

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
    expect(nextState.draftPlan?.operations[0]?.source).toBe('edited');
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

  it('builds project records and clears per-operation dirty state after save/load', () => {
    const state = stateWithPlan();
    const edited = workbenchReducer(state, {
      type: 'updateOperation',
      operationId: state.draftPlan!.operations[0]!.id,
      changes: { notes: 'Programmer override' },
      message: 'edit',
    });

    const projectRecord = buildProjectRecord(edited);
    expect(projectRecord?.plan.part.partId).toBe(samplePartInput.partId);
    expect(projectRecord?.plan.operations[0]?.isDirty).toBe(false);
    expect(projectRecord?.plan.operations[0]?.depthProfile?.setupPlane.label).toBe('Top setup plane');

    const loaded = workbenchReducer(edited, {
      type: 'projectLoaded',
      project: projectRecord!,
      message: 'load',
    });

    expect(loaded.dirty).toBe(false);
    expect(loaded.lastSavedAt).toBe(projectRecord?.updatedAt ?? null);
    expect(loaded.draftPlan?.operations.every((operation) => operation.isDirty === false)).toBe(true);
    expect(loaded.draftPlan?.features[0]?.depthModel?.stockTop.zMm).toBe(0);
  });

  it('tracks import session and preserves source metadata in project records', () => {
    const source = createModelSource({
      id: 'import-json-sample',
      type: 'json',
      filename: 'sample.json',
      mediaType: 'application/json',
    });
    const importSessionState = workbenchReducer(initialWorkbenchState, {
      type: 'importSessionLoaded',
      importSession: {
        id: 'import-json-sample',
        source,
        importStatus: 'success',
        warnings: ['Structured JSON import succeeded.'],
        importedModel: deriveImportedModelFromPart(source, samplePartInput),
        deterministicPartInput: samplePartInput,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'imported',
    });
    const planned = workbenchReducer(importSessionState, {
      type: 'planLoaded',
      plan: planPart(samplePartInput),
      message: 'planned',
    });

    const record = buildProjectRecord(planned);
    expect(record?.sourceType).toBe('json');
    expect(record?.sourceFilename).toBe('sample.json');
    expect(record?.sourceImportId).toBe('import-json-sample');
  });

  it('supports manual reclassification of inferred features without breaking draft state', () => {
    const plan = planPart({
      ...samplePartInput,
      contours: [
        {
          ...samplePartInput.contours[0]!,
          origin: 'geometry_inferred',
          confidence: 0.72,
          inferenceMethod: 'fixture',
          warnings: ['Review inferred contour classification.'],
          sourceGeometryRefs: ['geom-lwpolyline-0001'],
          classificationState: 'automatic',
        },
      ],
    });
    const state = workbenchReducer(initialWorkbenchState, {
      type: 'planLoaded',
      plan,
      message: 'loaded',
    });
    const featureId = state.draftPlan!.features.find((feature) => feature.origin === 'geometry_inferred')!.id;

    const reclassified = workbenchReducer(state, {
      type: 'reclassifyFeature',
      featureId,
      nextKind: 'slot',
      message: 'reclassify',
    });

    expect(reclassified.draftPlan?.features.find((feature) => feature.id === featureId)?.kind).toBe('slot');
    expect(reclassified.draftPlan?.features.find((feature) => feature.id === featureId)?.classificationState).toBe('manual_override');
    expect(reclassified.dirty).toBe(true);
  });

  it('freezes edited operations and accepts regenerated plans into dirty draft state', () => {
    const state = stateWithPlan();
    const operationId = state.draftPlan!.operations[0]!.id;

    const frozen = workbenchReducer(state, {
      type: 'toggleOperationFreeze',
      operationId,
      message: 'freeze',
    });
    expect(frozen.draftPlan?.operations.find((operation) => operation.id === operationId)?.frozen).toBe(true);

    const regenerated = workbenchReducer(frozen, {
      type: 'regeneratedPlanLoaded',
      plan: frozen.draftPlan!,
      message: 'regenerated',
    });
    expect(regenerated.dirty).toBe(true);
    expect(regenerated.draftPlan?.operations[0]?.order).toBe(0);
  });
});
