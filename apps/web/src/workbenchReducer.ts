import type {
  CamReview,
  DraftCamPlan,
  NormalizedFeature,
  Operation,
  PartInput,
  ProjectDraft,
  SelectedEntity,
  Tool,
} from '@cam/shared';

export type WorkbenchState = {
  sample: PartInput | null;
  draftPlan: DraftCamPlan | null;
  review: CamReview | null;
  selectedEntity: SelectedEntity | null;
  dirty: boolean;
  consoleMessages: string[];
  lastSavedAt: string | null;
};

export type WorkbenchAction =
  | { type: 'sampleLoaded'; sample: PartInput; message: string }
  | { type: 'planLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'reviewLoaded'; review: CamReview; message: string }
  | { type: 'approvalLoaded'; plan: DraftCamPlan; message: string }
  | { type: 'projectLoaded'; project: ProjectDraft; message: string }
  | { type: 'projectSaved'; savedAt: string; message: string }
  | { type: 'selectEntity'; entity: SelectedEntity | null }
  | { type: 'updateOperation'; operationId: string; changes: Partial<EditableOperationFields>; message: string }
  | { type: 'moveOperation'; operationId: string; direction: 'up' | 'down'; message: string }
  | { type: 'toggleOperation'; operationId: string; message: string }
  | { type: 'addManualOperation'; featureId: string; message: string }
  | { type: 'log'; message: string };

type EditableOperationFields = Pick<Operation, 'name' | 'strategy' | 'setup' | 'estimatedMinutes' | 'toolId'>;

export const initialWorkbenchState: WorkbenchState = {
  sample: null,
  draftPlan: null,
  review: null,
  selectedEntity: null,
  dirty: false,
  consoleMessages: ['Workbench ready. Load the sample or a saved draft to begin.'],
  lastSavedAt: null,
};

function appendConsole(state: WorkbenchState, message: string): WorkbenchState {
  return {
    ...state,
    consoleMessages: [`${new Date().toLocaleTimeString()}: ${message}`, ...state.consoleMessages].slice(0, 16),
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

function applyDraftEdit(plan: DraftCamPlan, operations: Operation[], note: string): DraftCamPlan {
  const nextOperations = orderedOperations(operations);
  const notes = plan.approval.notes.includes(note) ? plan.approval.notes : [...plan.approval.notes, note];

  return {
    ...plan,
    operations: nextOperations,
    estimatedCycleTimeMinutes: Math.max(sumEnabledMinutes(nextOperations), 0.5),
    approval: {
      state: 'in_review',
      requiresHumanApproval: true,
      notes,
    },
    summary: {
      ...plan.summary,
      operationCount: nextOperations.length,
    },
  };
}

function findTool(plan: DraftCamPlan, toolId: string): Tool | undefined {
  return plan.tools.find((tool) => tool.id === toolId);
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

function createManualOperation(plan: DraftCamPlan, featureId: string): Operation {
  const feature = plan.features.find((item) => item.id === featureId);
  if (!feature) {
    throw new Error('Feature not found for manual operation.');
  }

  const relatedOperation = orderedOperations(plan.operations).find((operation) => operation.featureId === featureId);
  const tool =
    (relatedOperation ? findTool(plan, relatedOperation.toolId) : undefined) ??
    plan.tools[0];

  if (!tool) {
    throw new Error('No tools are available for manual operation creation.');
  }

  return {
    id: `manual-${feature.id}-${crypto.randomUUID()}`,
    name: `Manual ${feature.name}`,
    kind: defaultOperationKind(feature),
    featureId: feature.id,
    toolId: tool.id,
    toolName: tool.name,
    setup: relatedOperation?.setup ?? 'Setup 1 / Top side',
    strategy: `Manual programmer note for ${feature.name}. Review before approval.`,
    estimatedMinutes: Math.max(relatedOperation?.estimatedMinutes ?? 1.5, 0.5),
    enabled: true,
    origin: 'manual',
    order: plan.operations.length,
  };
}

export function createProjectId(part: PartInput): string {
  return `${part.partId}-${part.revision}`;
}

export function buildProjectDraft(state: WorkbenchState): ProjectDraft | null {
  if (!state.draftPlan) {
    return null;
  }

  return {
    projectId: createProjectId(state.draftPlan.part),
    plan: state.draftPlan,
    ...(state.review ? { review: state.review } : {}),
    ...(state.selectedEntity ? { selectedEntity: state.selectedEntity } : {}),
    savedAt: new Date().toISOString(),
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
    case 'planLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.plan.part,
          draftPlan: action.plan,
          review: null,
          selectedEntity: action.plan.features[0]
            ? { type: 'feature', id: action.plan.features[0].id }
            : null,
          dirty: false,
          lastSavedAt: null,
        },
        action.message,
      );
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
          draftPlan: action.plan,
          dirty: false,
        },
        action.message,
      );
    case 'projectLoaded':
      return appendConsole(
        {
          ...state,
          sample: action.project.plan.part,
          draftPlan: action.project.plan,
          review: action.project.review ?? null,
          selectedEntity: action.project.selectedEntity ?? null,
          dirty: false,
          lastSavedAt: action.project.savedAt ?? null,
        },
        action.message,
      );
    case 'projectSaved':
      return appendConsole(
        {
          ...state,
          dirty: false,
          lastSavedAt: action.savedAt,
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

        return {
          ...operation,
          ...action.changes,
          toolId: nextToolId,
          toolName: nextTool?.name ?? operation.toolName,
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
      nextOperations.splice(targetIndex, 0, operation);

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
    case 'log':
      return appendConsole(state, action.message);
  }
}

export function getOrderedOperations(plan: DraftCamPlan | null): Operation[] {
  return plan ? orderedOperations(plan.operations) : [];
}
