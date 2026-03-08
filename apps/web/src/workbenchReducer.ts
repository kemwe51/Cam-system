import {
  buildPlanMetadata,
  type ImportSessionRecord,
  type ImportedModel,
  type ProjectRecord,
} from '@cam/model';
import {
  buildOperationGroupId,
  buildOperationGroups,
  getSetupLabel,
  type CamReview,
  type DraftCamPlan,
  type NormalizedFeature,
  type Operation,
  type PartInput,
  type SelectedEntity,
  type Tool,
} from '@cam/shared';

export type WorkbenchState = {
  sample: PartInput | null;
  draftPlan: DraftCamPlan | null;
  review: CamReview | null;
  selectedEntity: SelectedEntity | null;
  dirty: boolean;
  consoleMessages: string[];
  lastSavedAt: string | null;
  projects: ProjectRecord[];
  currentProject: ProjectRecord | null;
  currentImportSession: ImportSessionRecord | null;
  currentModel: ImportedModel | null;
  history: DraftCamPlan[];
  future: DraftCamPlan[];
};

export type WorkbenchAction =
  | { type: 'sampleLoaded'; sample: PartInput; message: string }
  | { type: 'importSessionLoaded'; importSession: ImportSessionRecord; message: string }
  | { type: 'planLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'reviewLoaded'; review: CamReview; message: string }
  | { type: 'approvalLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'projectCatalogLoaded'; projects: ProjectRecord[]; message: string }
  | { type: 'projectLoaded'; project: ProjectRecord; message: string }
  | { type: 'projectSaved'; project: ProjectRecord; message: string }
  | { type: 'regeneratedPlanLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'selectEntity'; entity: SelectedEntity | null }
  | { type: 'updateOperation'; operationId: string; changes: Partial<EditableOperationFields>; message: string }
  | { type: 'moveOperation'; operationId: string; direction: 'up' | 'down'; message: string }
  | { type: 'toggleOperation'; operationId: string; message: string }
  | { type: 'toggleOperationFreeze'; operationId: string; message: string }
  | { type: 'addManualOperation'; featureId: string; message: string }
  | { type: 'reclassifyFeature'; featureId: string; nextKind: 'contour' | 'pocket' | 'slot' | 'hole_group' | 'ignore' | 'unclassified'; message: string }
  | { type: 'duplicateOperation'; operationId: string; message: string }
  | { type: 'deleteManualOperation'; operationId: string; message: string }
  | { type: 'undo'; message: string }
  | { type: 'redo'; message: string }
  | { type: 'log'; message: string };

type EditableOperationFields = Pick<Operation, 'name' | 'strategy' | 'setup' | 'setupId' | 'notes' | 'estimatedMinutes' | 'toolId' | 'featureId'>;

export const initialWorkbenchState: WorkbenchState = {
  sample: null,
  draftPlan: null,
  review: null,
  selectedEntity: null,
  dirty: false,
  consoleMessages: ['Workbench ready. Start an import session or load a saved project to begin.'],
  lastSavedAt: null,
  projects: [],
  currentProject: null,
  currentImportSession: null,
  currentModel: null,
  history: [],
  future: [],
};

function appendConsole(state: WorkbenchState, message: string): WorkbenchState {
  return {
    ...state,
    consoleMessages: [`${new Date().toLocaleTimeString()}: ${message}`, ...state.consoleMessages].slice(0, 20),
  };
}

function orderedOperations(operations: Operation[]): Operation[] {
  return [...operations]
    .sort((left, right) => left.order - right.order)
    .map((operation, index) => ({
      ...operation,
      order: index,
      source:
        operation.origin === 'manual'
          ? 'manual'
          : operation.isDirty && operation.source !== 'generated'
            ? operation.source
            : operation.source ?? 'generated',
    }));
}

function editedSource(operation: Operation): Operation['source'] {
  return operation.origin === 'manual' ? 'manual' : 'edited';
}

function sumEnabledMinutes(operations: Operation[]): number {
  return Number(
    operations
      .filter((operation) => operation.enabled)
      .reduce((sum, operation) => sum + operation.estimatedMinutes, 0)
      .toFixed(1),
  );
}

function normalizeSavedPlan(plan: DraftCamPlan): DraftCamPlan {
  return {
    ...plan,
    operations: orderedOperations(plan.operations).map((operation) => ({
      ...operation,
      isDirty: false,
    })),
  };
}

function derivePlanTools(plan: DraftCamPlan, operations: Operation[]): Tool[] {
  const toolIds = new Set(operations.map((operation) => operation.toolId));
  const catalog = plan.toolLibrary.tools.length > 0 ? plan.toolLibrary.tools : plan.tools;
  const catalogMap = new Map(catalog.map((tool) => [tool.id, tool]));
  return [...toolIds].map((toolId) => catalogMap.get(toolId)).filter((tool): tool is Tool => Boolean(tool));
}

function pushHistory(state: WorkbenchState, currentPlan: DraftCamPlan): Pick<WorkbenchState, 'history' | 'future'> {
  return {
    history: [...state.history, normalizeSavedPlan(currentPlan)].slice(-30),
    future: [],
  };
}

function applyDraftEdit(state: WorkbenchState, operations: Operation[], note: string): WorkbenchState {
  if (!state.draftPlan) {
    return state;
  }

  const nextOperations = operations.map((operation, index) => ({
    ...operation,
    order: index,
  }));
  const notes = state.draftPlan.approval.notes.includes(note) ? state.draftPlan.approval.notes : [...state.draftPlan.approval.notes, note];
  const nextPlan: DraftCamPlan = {
    ...state.draftPlan,
    operationGroups: buildOperationGroups(nextOperations, state.draftPlan.features),
    operations: nextOperations,
    tools: derivePlanTools(state.draftPlan, nextOperations),
    estimatedCycleTimeMinutes: Math.max(sumEnabledMinutes(nextOperations), 0.5),
    approval: {
      state: 'in_review',
      requiresHumanApproval: true,
      notes,
    },
    summary: {
      ...state.draftPlan.summary,
      operationCount: nextOperations.length,
      enabledOperationCount: nextOperations.filter((operation) => operation.enabled).length,
      manualOperationCount: nextOperations.filter((operation) => operation.origin === 'manual').length,
    },
  };

  return {
    ...state,
    ...pushHistory(state, state.draftPlan),
    draftPlan: nextPlan,
    review: null,
    dirty: true,
  };
}

function findTool(plan: DraftCamPlan, toolId: string): Tool | undefined {
  return plan.toolLibrary.tools.find((tool) => tool.id === toolId) ?? plan.tools.find((tool) => tool.id === toolId);
}

function defaultOperationKind(feature: NormalizedFeature): Operation['kind'] {
  switch (feature.kind) {
    case 'top_surface':
      return 'face';
    case 'contour':
      return 'profile';
    case 'pocket':
      return 'pocket';
    case 'slot':
      return 'slot';
    case 'hole_group':
      return 'drill';
    case 'chamfer':
      return 'chamfer';
    case 'engraving':
      return 'engrave';
  }
}

let fallbackIdCounter = 0;

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  fallbackIdCounter += 1;
  return `${Date.now()}-${fallbackIdCounter}-${Math.random().toString(16).slice(2)}`;
}

function operationId(prefix: string, featureId: string): string {
  return `${prefix}-${featureId}-${createUuid()}`;
}

function createManualOperation(plan: DraftCamPlan, featureId: string, baseOperation?: Operation): Operation {
  const feature = plan.features.find((item) => item.id === featureId);
  if (!feature) {
    throw new Error('Feature not found for manual operation.');
  }

  const relatedOperation = baseOperation ?? orderedOperations(plan.operations).find((operation) => operation.featureId === featureId);
  const tool = (relatedOperation ? findTool(plan, relatedOperation.toolId) : undefined) ?? plan.toolLibrary.tools[0] ?? plan.tools[0];

  if (!tool) {
    throw new Error('No tools are available for manual operation creation.');
  }

  const setupId = relatedOperation?.setupId ?? plan.setups[0]?.id ?? 'setup-1';
  const setup = relatedOperation?.setup ?? getSetupLabel(plan.setups, setupId);

  return {
    id: operationId('manual', feature.id),
    name: baseOperation ? `${baseOperation.name} copy` : `Manual ${feature.name}`,
    kind: baseOperation?.kind ?? defaultOperationKind(feature),
    featureId: feature.id,
    toolId: tool.id,
    toolName: tool.name,
    setupId,
    setup,
    groupId: buildOperationGroupId(setupId, feature.id),
    strategy:
      baseOperation?.strategy ?? `Manual programmer note for ${feature.name}. Review before approval and release.`,
    notes: baseOperation?.notes ?? '',
    estimatedMinutes: Math.max(baseOperation?.estimatedMinutes ?? relatedOperation?.estimatedMinutes ?? 1.5, 0.5),
    enabled: true,
    origin: 'manual',
    source: 'manual',
    order: plan.operations.length,
    isDirty: true,
    frozen: true,
    links: baseOperation?.links ?? [{ featureId: feature.id, sourceGeometryRefs: feature.sourceGeometryRefs }],
    warnings: baseOperation?.warnings ?? [],
    assumptions: baseOperation?.assumptions ?? [],
    machiningIntent: feature.machiningIntent,
    depthProfile: baseOperation?.depthProfile ?? relatedOperation?.depthProfile ?? (feature.depthModel
      ? {
          setupPlane: feature.depthModel.setupPlane,
          stockTop: feature.depthModel.stockTop,
          floorLevel: feature.depthModel.floorLevel,
          depthRange: feature.depthModel.depthRange,
          ...(feature.depthMm > 0 ? { targetDepthMm: feature.depthMm } : {}),
          assumptions: feature.depthModel.assumptions,
          warnings: feature.depthModel.warnings,
        }
      : undefined),
  };
}

export function createProjectId(part: PartInput): string {
  return `${part.partId}-${part.revision}`;
}

export function buildProjectRecord(state: WorkbenchState): ProjectRecord | null {
  if (!state.draftPlan) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const normalizedPlan = normalizeSavedPlan(state.draftPlan);
  const projectId = createProjectId(normalizedPlan.part);
  const importWarnings = state.currentImportSession?.warnings ?? [];
  const modelWarnings = state.currentModel?.warnings ?? [];
  return {
    projectId,
    revision: state.currentProject?.revision ?? 0,
    sourceImportId: state.currentImportSession?.id,
    sourceType: state.currentImportSession?.source.type,
    sourceFilename: state.currentImportSession?.source.filename,
    derivedModel: state.currentModel ?? undefined,
    planMetadata: buildPlanMetadata(normalizedPlan),
    approvalState: normalizedPlan.approval.state,
    updatedAt,
    warnings: [...importWarnings, ...modelWarnings],
    plan: normalizedPlan,
    review: state.review ?? undefined,
    selectedEntity: state.selectedEntity ?? undefined,
    revisions: state.currentProject?.revisions ?? [],
  };
}

export function resolveSelectedFeatureId(plan: DraftCamPlan | null, entity: SelectedEntity | null): string | null {
  if (!plan || !entity) {
    return null;
  }

  if (entity.type === 'feature') {
    return entity.id;
  }

  if (entity.type === 'operation') {
    return plan.operations.find((operation) => operation.id === entity.id)?.featureId ?? null;
  }

  if (entity.type === 'geometry') {
    return null;
  }

  return null;
}

export function unsavedOperationSummary(plan: DraftCamPlan | null): { modified: number; manual: number; disabled: number } {
  if (!plan) {
    return { modified: 0, manual: 0, disabled: 0 };
  }
  return {
    modified: plan.operations.filter((operation) => operation.isDirty).length,
    manual: plan.operations.filter((operation) => operation.origin === 'manual').length,
    disabled: plan.operations.filter((operation) => !operation.enabled).length,
  };
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'sampleLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.sample,
        },
        action.message,
      );
    case 'importSessionLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.importSession.deterministicPartInput ?? state.sample,
          currentImportSession: action.importSession,
          currentModel: action.importSession.importedModel ?? null,
          draftPlan: null,
          review: null,
          selectedEntity: null,
          dirty: false,
          lastSavedAt: action.importSession.updatedAt,
          history: [],
          future: [],
        },
        action.message,
      );
    case 'planLoaded': {
      const plan = normalizeSavedPlan(action.plan);
      return appendConsole(
        {
          ...state,
          sample: plan.part,
          draftPlan: plan,
          review: null,
          currentProject: null,
          selectedEntity: plan.features[0] ? { type: 'feature', id: plan.features[0].id } : null,
          dirty: false,
          lastSavedAt: null,
          history: [],
          future: [],
        },
        action.message,
      );
    }
    case 'reviewLoaded':
      return appendConsole(
        {
          ...state,
          review: action.review,
        },
        action.message,
      );
    case 'approvalLoaded':
      return appendConsole(
        {
          ...state,
          draftPlan: normalizeSavedPlan(action.plan),
          dirty: false,
        },
        action.message,
      );
    case 'projectCatalogLoaded':
      return appendConsole(
        {
          ...state,
          projects: action.projects,
        },
        action.message,
      );
    case 'projectLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.project.plan.part,
          draftPlan: normalizeSavedPlan(action.project.plan),
          review: action.project.review ?? null,
          selectedEntity: action.project.selectedEntity ?? null,
          dirty: false,
          lastSavedAt: action.project.updatedAt,
          currentProject: action.project,
          currentModel: action.project.derivedModel ?? null,
          history: [],
          future: [],
        },
        action.message,
      );
    case 'projectSaved':
      return appendConsole(
        {
          ...state,
          draftPlan: normalizeSavedPlan(action.project.plan),
          projects: [action.project, ...state.projects.filter((project) => project.projectId !== action.project.projectId)],
          currentProject: action.project,
          currentModel: action.project.derivedModel ?? state.currentModel,
          dirty: false,
          lastSavedAt: action.project.updatedAt,
          history: [],
          future: [],
        },
        action.message,
      );
    case 'regeneratedPlanLoaded':
      return appendConsole(
        {
          ...state,
          ...pushHistory(state, state.draftPlan ?? action.plan),
          draftPlan: normalizeSavedPlan(action.plan),
          review: null,
          dirty: true,
        },
        action.message,
      );
    case 'selectEntity':
      return {
        ...state,
        selectedEntity: action.entity,
      };
    case 'updateOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;

      const nextOperations = draftPlan.operations.map((operation) => {
        if (operation.id !== action.operationId) {
          return operation;
        }

        const nextToolId = action.changes.toolId ?? operation.toolId;
        const nextTool = findTool(draftPlan, nextToolId) ?? findTool(draftPlan, operation.toolId);
        const nextFeatureId = action.changes.featureId ?? operation.featureId;
        const nextSetupId = action.changes.setupId ?? operation.setupId;
        const nextSetup = action.changes.setup ?? getSetupLabel(draftPlan.setups, nextSetupId, operation.setup);

          return {
            ...operation,
            ...action.changes,
          featureId: nextFeatureId,
          setupId: nextSetupId,
          setup: nextSetup,
            groupId: buildOperationGroupId(nextSetupId, nextFeatureId),
            toolId: nextToolId,
            toolName: nextTool?.name ?? operation.toolName,
            source: editedSource(operation),
            isDirty: true,
          };
        });

      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            nextOperations,
            'Manual edits changed the draft plan. Review and approval are required before release.',
          ),
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'moveOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const currentOperations = orderedOperations(state.draftPlan.operations);
      const currentIndex = currentOperations.findIndex((operation) => operation.id === action.operationId);
      const offset = action.direction === 'up' ? -1 : 1;
      const targetIndex = currentIndex + offset;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentOperations.length) {
        return state;
      }

       const nextOperations = [...currentOperations];
      const [operation] = nextOperations.splice(currentIndex, 1);
      if (!operation) {
        return state;
      }
       nextOperations.splice(targetIndex, 0, {
         ...operation,
         source: editedSource(operation),
         isDirty: true,
       });

      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            nextOperations,
            'Operation order changed in the manual draft. Review and approval are required before release.',
          ),
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'toggleOperation': {
      if (!state.draftPlan) {
        return state;
      }

      const nextOperations = state.draftPlan.operations.map((operation) =>
        operation.id === action.operationId
          ? {
              ...operation,
              enabled: !operation.enabled,
              source: editedSource(operation),
              isDirty: true,
            }
          : operation,
      );

      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            nextOperations,
            'Operation enablement changed in the draft. Review machining coverage before release.',
          ),
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'toggleOperationFreeze': {
      if (!state.draftPlan) {
        return state;
      }

      const nextOperations = state.draftPlan.operations.map((operation) =>
        operation.id === action.operationId
          ? {
              ...operation,
              frozen: !operation.frozen,
              source: editedSource(operation),
              isDirty: true,
            }
          : operation,
      );

      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            nextOperations,
            'Operation freeze state changed in the draft. Regeneration must be reviewed before release.',
          ),
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'addManualOperation': {
      if (!state.draftPlan) {
        return state;
      }

      const manualOperation = createManualOperation(state.draftPlan, action.featureId);
      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            [...state.draftPlan.operations, manualOperation],
            'Manual operations were added to the draft. Review and approval are required before release.',
          ),
          selectedEntity: { type: 'operation', id: manualOperation.id },
        },
        action.message,
      );
    }
    case 'reclassifyFeature': {
      if (!state.draftPlan) {
        return state;
      }
      const nextFeatures = state.draftPlan.features.map((feature) => {
        if (feature.id !== action.featureId) {
          return feature;
        }

        const nextWarnings = [...feature.warnings];
        if (action.nextKind === 'ignore' || action.nextKind === 'unclassified') {
          if (!nextWarnings.includes('Manual classification changed this imported feature to ignore/unclassified. Review linked operations before release.')) {
            nextWarnings.push('Manual classification changed this imported feature to ignore/unclassified. Review linked operations before release.');
          }
          return {
            ...feature,
            classificationState: 'ignored' as const,
            warnings: nextWarnings,
          };
        }

        if (!nextWarnings.includes(`Manual classification override set the feature to ${action.nextKind}. Existing operations remain draft-level and must be reviewed.`)) {
          nextWarnings.push(`Manual classification override set the feature to ${action.nextKind}. Existing operations remain draft-level and must be reviewed.`);
        }
        return {
          ...feature,
          kind: action.nextKind,
          classificationState: 'manual_override' as const,
          warnings: nextWarnings,
        };
      });
      const nextOperations = state.draftPlan.operations.map((operation) =>
        operation.featureId !== action.featureId || operation.origin === 'manual'
          ? operation
          : {
              ...operation,
              enabled: action.nextKind === 'ignore' || action.nextKind === 'unclassified' ? false : operation.enabled,
              source: 'edited' as const,
              isDirty: true,
            },
      );
      const draftEdit = applyDraftEdit(
        {
          ...state,
          draftPlan: {
            ...state.draftPlan,
            features: nextFeatures,
          },
        },
        nextOperations,
        'Feature classification was overridden in the draft. Imported-geometry assumptions and linked operations require human review before release.',
      );
      return appendConsole(
        {
          ...draftEdit,
          draftPlan: draftEdit.draftPlan
            ? {
                ...draftEdit.draftPlan,
                features: nextFeatures,
              }
            : null,
          selectedEntity: { type: 'feature', id: action.featureId },
        },
        action.message,
      );
    }
    case 'duplicateOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const sourceOperation = state.draftPlan.operations.find((operation) => operation.id === action.operationId);
      if (!sourceOperation) {
        return state;
      }

      const manualCopy = createManualOperation(state.draftPlan, sourceOperation.featureId, sourceOperation);
      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            [...state.draftPlan.operations, manualCopy],
            'An operation was duplicated into a manual draft override. Review is required before release.',
          ),
          selectedEntity: { type: 'operation', id: manualCopy.id },
        },
        action.message,
      );
    }
    case 'deleteManualOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const operation = state.draftPlan.operations.find((item) => item.id === action.operationId);
      if (!operation || operation.origin !== 'manual') {
        return state;
      }

      const nextOperations = state.draftPlan.operations.filter((item) => item.id !== action.operationId);
      return appendConsole(
        {
          ...applyDraftEdit(
            state,
            nextOperations,
            'A manual operation was deleted from the draft. Review and approval are required before release.',
          ),
          selectedEntity: { type: 'feature', id: operation.featureId },
        },
        action.message,
      );
    }
    case 'undo': {
      if (!state.draftPlan || state.history.length === 0) {
        return state;
      }
      const previous = state.history[state.history.length - 1];
      if (!previous) {
        return state;
      }
      return appendConsole(
        {
          ...state,
          draftPlan: previous,
          history: state.history.slice(0, -1),
          future: [normalizeSavedPlan(state.draftPlan), ...state.future].slice(0, 30),
          dirty: true,
        },
        action.message,
      );
    }
    case 'redo': {
      if (!state.draftPlan || state.future.length === 0) {
        return state;
      }
      const [next, ...remaining] = state.future;
      if (!next) {
        return state;
      }
      return appendConsole(
        {
          ...state,
          draftPlan: next,
          history: [...state.history, normalizeSavedPlan(state.draftPlan)].slice(-30),
          future: remaining,
          dirty: true,
        },
        action.message,
      );
    }
    case 'log':
      return appendConsole(state, action.message);
  }
}

export function getOrderedOperations(plan: DraftCamPlan | null): Operation[] {
  return plan ? orderedOperations(plan.operations) : [];
}
