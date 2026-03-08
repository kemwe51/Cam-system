import {
  buildOperationGroupId,
  buildOperationGroups,
  buildProjectMetadata,
  getSetupLabel,
  type CamReview,
  type DraftCamPlan,
  type NormalizedFeature,
  type Operation,
  type PartInput,
  type ProjectDraft,
  type ProjectSummary,
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
  projects: ProjectSummary[];
};

export type WorkbenchAction =
  | { type: 'sampleLoaded'; sample: PartInput; message: string }
  | { type: 'planLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'reviewLoaded'; review: CamReview; message: string }
  | { type: 'approvalLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'projectCatalogLoaded'; projects: ProjectSummary[]; message: string }
  | { type: 'projectLoaded'; project: ProjectDraft; message: string }
  | { type: 'projectSaved'; project: ProjectDraft; message: string }
  | { type: 'selectEntity'; entity: SelectedEntity | null }
  | { type: 'updateOperation'; operationId: string; changes: Partial<EditableOperationFields>; message: string }
  | { type: 'moveOperation'; operationId: string; direction: 'up' | 'down'; message: string }
  | { type: 'toggleOperation'; operationId: string; message: string }
  | { type: 'addManualOperation'; featureId: string; message: string }
  | { type: 'duplicateOperation'; operationId: string; message: string }
  | { type: 'deleteManualOperation'; operationId: string; message: string }
  | { type: 'log'; message: string };

type EditableOperationFields = Pick<Operation, 'name' | 'strategy' | 'setup' | 'setupId' | 'notes' | 'estimatedMinutes' | 'toolId'>;

export const initialWorkbenchState: WorkbenchState = {
  sample: null,
  draftPlan: null,
  review: null,
  selectedEntity: null,
  dirty: false,
  consoleMessages: ['Workbench ready. Load the sample or a saved project to begin.'],
  lastSavedAt: null,
  projects: [],
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
    }));
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

function applyDraftEdit(plan: DraftCamPlan, operations: Operation[], note: string): DraftCamPlan {
  const nextOperations = operations.map((operation, index) => ({
    ...operation,
    order: index,
  }));
  const notes = plan.approval.notes.includes(note) ? plan.approval.notes : [...plan.approval.notes, note];

  return {
    ...plan,
    operationGroups: buildOperationGroups(nextOperations, plan.features),
    operations: nextOperations,
    tools: derivePlanTools(plan, nextOperations),
    estimatedCycleTimeMinutes: Math.max(sumEnabledMinutes(nextOperations), 0.5),
    approval: {
      state: 'in_review',
      requiresHumanApproval: true,
      notes,
    },
    summary: {
      ...plan.summary,
      operationCount: nextOperations.length,
      enabledOperationCount: nextOperations.filter((operation) => operation.enabled).length,
      manualOperationCount: nextOperations.filter((operation) => operation.origin === 'manual').length,
    },
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
    order: plan.operations.length,
    isDirty: true,
  };
}

export function createProjectId(part: PartInput): string {
  return `${part.partId}-${part.revision}`;
}

export function buildProjectDraft(state: WorkbenchState): ProjectDraft | null {
  if (!state.draftPlan) {
    return null;
  }

  const savedAt = new Date().toISOString();
  return {
    projectId: createProjectId(state.draftPlan.part),
    metadata: buildProjectMetadata(createProjectId(state.draftPlan.part), state.draftPlan, savedAt, false),
    plan: normalizeSavedPlan(state.draftPlan),
    ...(state.review ? { review: state.review } : {}),
    ...(state.selectedEntity ? { selectedEntity: state.selectedEntity } : {}),
    savedAt,
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

  return null;
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'sampleLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.sample,
          draftPlan: null,
          review: null,
          selectedEntity: null,
          dirty: false,
          lastSavedAt: null,
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
          selectedEntity: plan.features[0] ? { type: 'feature', id: plan.features[0].id } : null,
          dirty: false,
          lastSavedAt: null,
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
          lastSavedAt: action.project.savedAt ?? action.project.metadata?.updatedAt ?? null,
        },
        action.message,
      );
    case 'projectSaved':
      return appendConsole(
        {
          ...state,
          draftPlan: normalizeSavedPlan(action.project.plan),
          projects: [
            ...(action.project.metadata ? [action.project.metadata] : []),
            ...state.projects.filter((project) => project.projectId !== action.project.projectId),
          ],
          dirty: false,
          lastSavedAt: action.project.savedAt ?? action.project.metadata?.updatedAt ?? null,
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
        const nextSetupId = action.changes.setupId ?? operation.setupId;
        const nextSetup = action.changes.setup ?? getSetupLabel(draftPlan.setups, nextSetupId, operation.setup);

        return {
          ...operation,
          ...action.changes,
          setupId: nextSetupId,
          setup: nextSetup,
          groupId: buildOperationGroupId(nextSetupId, operation.featureId),
          toolId: nextToolId,
          toolName: nextTool?.name ?? operation.toolName,
          isDirty: true,
        };
      });

      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            nextOperations,
            'Manual edits changed the draft plan. Review and approval are required before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'moveOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;

      const currentOperations = orderedOperations(draftPlan.operations);
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
      nextOperations.splice(targetIndex, 0, { ...operation, isDirty: true });

      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            nextOperations,
            'Operation order changed in the manual draft. Review and approval are required before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'toggleOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;

      const nextOperations = draftPlan.operations.map((operation) =>
        operation.id === action.operationId
          ? {
              ...operation,
              enabled: !operation.enabled,
              isDirty: true,
            }
          : operation,
      );

      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            nextOperations,
            'Operation enablement changed in the draft. Review machining coverage before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'operation', id: action.operationId },
        },
        action.message,
      );
    }
    case 'addManualOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;

      const manualOperation = createManualOperation(draftPlan, action.featureId);
      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            [...draftPlan.operations, manualOperation],
            'Manual operations were added to the draft. Review and approval are required before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'operation', id: manualOperation.id },
        },
        action.message,
      );
    }
    case 'duplicateOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;
      const sourceOperation = draftPlan.operations.find((operation) => operation.id === action.operationId);
      if (!sourceOperation) {
        return state;
      }

      const manualCopy = createManualOperation(draftPlan, sourceOperation.featureId, sourceOperation);
      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            [...draftPlan.operations, manualCopy],
            'An operation was duplicated into a manual draft override. Review is required before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'operation', id: manualCopy.id },
        },
        action.message,
      );
    }
    case 'deleteManualOperation': {
      if (!state.draftPlan) {
        return state;
      }
      const draftPlan = state.draftPlan;
      const operation = draftPlan.operations.find((item) => item.id === action.operationId);
      if (!operation || operation.origin !== 'manual') {
        return state;
      }

      const nextOperations = draftPlan.operations.filter((item) => item.id !== action.operationId);
      return appendConsole(
        {
          ...state,
          draftPlan: applyDraftEdit(
            draftPlan,
            nextOperations,
            'A manual operation was deleted from the draft. Review and approval are required before release.',
          ),
          review: null,
          dirty: true,
          selectedEntity: { type: 'feature', id: operation.featureId },
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
