import { type ImportedModel, type ImportSessionRecord, type ProjectRecord } from '@cam/model';
import { camReviewSchema, type CamReview, type DraftCamPlan, type Operation } from '@cam/shared';

export type ReviewSupplementalContext = {
  importSession?: Pick<ImportSessionRecord, 'id' | 'importStatus' | 'warnings' | 'source'>;
  model?: ImportedModel;
  project?: Pick<ProjectRecord, 'projectId' | 'revision' | 'warnings' | 'sourceImportId' | 'sourceFilename' | 'sourceType'>;
};

type ReviewOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model?: string;
  context?: ReviewSupplementalContext;
};

type ReviewContext = {
  plan: DraftCamPlan;
  importSource: ReviewSupplementalContext['importSession'];
  modelContext: {
    status?: ImportedModel['status'];
    warnings: string[];
    sourceGeometryMetadata: string[];
    entityCount?: number;
    featureLinkCount?: number;
    extractedFeatureCount?: number;
    openProfileCount?: number;
    closedProfileCount?: number;
    unclassifiedGeometryCount?: number;
    extractionWarnings: string[];
    previewSummary: {
      linkedFeatureCount: number;
      extractedFeatureWarningCount: number;
    };
  };
  projectContext: {
    projectId?: string;
    revision?: number;
    sourceImportId?: string;
    sourceFilename?: string;
    sourceType?: string;
    warnings: string[];
  };
  currentDraftState: {
    approvalState: DraftCamPlan['approval']['state'];
    estimatedCycleTimeMinutes: number;
    manualOperationCount: number;
    disabledOperationCount: number;
    modifiedOperationCount: number;
  };
  warningBuckets: {
    modelSourceWarnings: string[];
    planningWarnings: string[];
    manualOverrideNotes: string[];
  };
  manualOverrides: Array<{
    id: string;
    name: string;
    featureId: string;
    origin: Operation['origin'];
    enabled: boolean;
    setup: string;
    strategy: string;
    notes: string;
    estimatedMinutes: number;
    toolName: string;
    isDirty: boolean;
  }>;
};

function reviewContext(plan: DraftCamPlan, context: ReviewSupplementalContext = {}): ReviewContext {
  const manualOverrides = plan.operations
    .filter((operation) => operation.origin === 'manual' || !operation.enabled || operation.isDirty)
    .map((operation) => ({
      id: operation.id,
      name: operation.name,
      featureId: operation.featureId,
      origin: operation.origin,
      enabled: operation.enabled,
      setup: operation.setup,
      strategy: operation.strategy,
      notes: operation.notes,
      estimatedMinutes: operation.estimatedMinutes,
      toolName: operation.toolName,
      isDirty: operation.isDirty,
    }));

  return {
    plan,
    importSource: context.importSession,
    modelContext: {
      ...(context.model?.status ? { status: context.model.status } : {}),
      warnings: context.model?.warnings ?? [],
      sourceGeometryMetadata: context.model?.sourceGeometryMetadata ?? [],
      ...(typeof context.model?.entities.length === 'number' ? { entityCount: context.model.entities.length } : {}),
      ...(typeof context.model?.featureGeometryLinks.length === 'number'
        ? { featureLinkCount: context.model.featureGeometryLinks.length }
        : {}),
      ...(typeof context.model?.extractedFeatures.length === 'number'
        ? { extractedFeatureCount: context.model.extractedFeatures.length }
        : {}),
      ...(typeof context.model?.geometryGraph?.openProfileIds.length === 'number'
        ? { openProfileCount: context.model.geometryGraph.openProfileIds.length }
        : {}),
      ...(typeof context.model?.geometryGraph?.closedProfileIds.length === 'number'
        ? { closedProfileCount: context.model.geometryGraph.closedProfileIds.length }
        : {}),
      ...(typeof context.model?.geometryDocument?.entities.length === 'number'
        ? {
            unclassifiedGeometryCount: context.model.geometryDocument.entities.filter(
              (entity) => !context.model?.extractedFeatures.some((feature) => feature.sourceGeometryRefs.includes(entity.id)),
            ).length,
          }
        : {}),
      extractionWarnings: context.model?.extractedFeatures.flatMap((feature) => feature.warnings) ?? [],
      previewSummary: {
        linkedFeatureCount: context.model?.featureGeometryLinks.length ?? 0,
        extractedFeatureWarningCount: context.model?.extractedFeatures.flatMap((feature) => feature.warnings).length ?? 0,
      },
    },
    projectContext: {
      ...(context.project?.projectId ? { projectId: context.project.projectId } : {}),
      ...(typeof context.project?.revision === 'number' ? { revision: context.project.revision } : {}),
      ...(context.project?.sourceImportId ? { sourceImportId: context.project.sourceImportId } : {}),
      ...(context.project?.sourceFilename ? { sourceFilename: context.project.sourceFilename } : {}),
      ...(context.project?.sourceType ? { sourceType: context.project.sourceType } : {}),
      warnings: context.project?.warnings ?? [],
    },
    currentDraftState: {
      approvalState: plan.approval.state,
      estimatedCycleTimeMinutes: plan.estimatedCycleTimeMinutes,
      manualOperationCount: plan.operations.filter((operation) => operation.origin === 'manual').length,
      disabledOperationCount: plan.operations.filter((operation) => !operation.enabled).length,
      modifiedOperationCount: plan.operations.filter((operation) => operation.isDirty).length,
    },
    warningBuckets: {
      modelSourceWarnings: [...(context.importSession?.warnings ?? []), ...(context.model?.warnings ?? [])],
      planningWarnings: plan.risks.map((risk) => `${risk.level.toUpperCase()}: ${risk.title}`),
      manualOverrideNotes: manualOverrides.flatMap((operation) => [operation.notes, operation.strategy].filter(Boolean)),
    },
    manualOverrides,
  };
}

function heuristicReview(plan: DraftCamPlan, context: ReviewSupplementalContext = {}): CamReview {
  const reviewData = reviewContext(plan, context);
  const riskFlags = [...reviewData.warningBuckets.modelSourceWarnings, ...reviewData.warningBuckets.planningWarnings];
  const missingOperations: string[] = [];
  const suggestedEdits: string[] = [];

  if (plan.features.some((feature) => feature.kind === 'hole_group')) {
    suggestedEdits.push('Confirm whether holes need chamfer, countersink, thread, or ream follow-up operations.');
  }

  if (plan.features.some((feature) => feature.kind === 'pocket' && feature.depthMm >= 12)) {
    suggestedEdits.push('Review pocket step-down, holder clearance, and remaining machining for the deep pocket before release.');
  }

  if (plan.features.every((feature) => feature.kind !== 'top_surface')) {
    missingOperations.push('Confirm whether an initial facing pass is still required to establish the Z datum.');
  }

  if (plan.operations.some((operation) => operation.origin === 'manual')) {
    suggestedEdits.push('Manual operations are present; verify they do not duplicate or conflict with deterministic operations.');
  }

  if (plan.operations.some((operation) => !operation.enabled)) {
    suggestedEdits.push('Disabled operations should be reviewed to confirm the feature still has complete machining coverage.');
  }

  if (plan.operations.some((operation) => operation.isDirty)) {
    suggestedEdits.push('Modified operations are unsaved draft overrides and should be re-reviewed before approval.');
  }

  if (context.model?.status === 'placeholder') {
    suggestedEdits.push('Imported model is still a placeholder session. Do not treat DXF/STEP source metadata as machinable geometry.');
  }

  if ((context.model?.geometryGraph?.openProfileIds.length ?? 0) > 0) {
    suggestedEdits.push(`Imported geometry still contains ${context.model?.geometryGraph?.openProfileIds.length ?? 0} open profiles. Confirm whether they represent engraving, construction geometry, or missing contour closure.`);
  }

  const unclassifiedGeometryCount = context.model?.geometryDocument?.entities.filter(
    (entity) => !context.model?.extractedFeatures.some((feature) => feature.sourceGeometryRefs.includes(entity.id)),
  ).length ?? 0;
  if (unclassifiedGeometryCount > 0) {
    missingOperations.push(`There are ${unclassifiedGeometryCount} unclassified imported geometry entities. Confirm whether they should remain ignored or become machinable features.`);
  }

  if (context.model?.extractedFeatures.some((feature) => feature.classificationState !== 'automatic')) {
    suggestedEdits.push('Manual feature reclassifications are present. Confirm that linked operations still match the updated manufacturing intent.');
  }

  if (context.project?.revision) {
    suggestedEdits.push(`Project revision ${context.project.revision} contains manual planning history. Review changes before approval.`);
  }

  return camReviewSchema.parse({
    mode: 'stub',
    missingOperations,
    riskFlags,
    suggestedEdits,
    overallAssessment:
      riskFlags.length > 0
        ? 'Draft plan is plausible, but the highlighted source/model warnings, planning risks, and manual overrides should be reviewed by an NC programmer before approval.'
        : 'Draft plan looks consistent with the structured part input and current model metadata. Human approval is still required before release.',
    approvalRecommendation: riskFlags.length > 0 || plan.operations.some((operation) => operation.isDirty) ? 'hold' : 'review',
    fallbackUsed: true,
  });
}

function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const direct = Reflect.get(payload, 'output_text');
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct;
  }

  const output = Reflect.get(payload, 'output');
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const content = Reflect.get(item, 'content');
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (typeof contentItem !== 'object' || contentItem === null) {
        continue;
      }

      const text = Reflect.get(contentItem, 'text');
      if (typeof text === 'string' && text.trim().length > 0) {
        return text;
      }
    }
  }

  return undefined;
}

export async function reviewDraftPlan(plan: DraftCamPlan, options: ReviewOptions = {}): Promise<CamReview> {
  const fallback = heuristicReview(plan, options.context);
  const apiKey = options.apiKey?.trim();

  if (!apiKey) {
    return fallback;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? 'gpt-5.4';
  const prompt = [
    'You are an advisory CAM reviewer. The deterministic plan remains the source of manufacturing authority.',
    'Review the provided deterministic draft plan for 2D and 2.5D milling only.',
    'Return strict JSON matching this TypeScript shape:',
    JSON.stringify({
      mode: 'openai',
      missingOperations: ['string'],
      riskFlags: ['string'],
      suggestedEdits: ['string'],
      overallAssessment: 'string',
      approvalRecommendation: 'hold | review | approve_with_human_signoff',
      fallbackUsed: false,
    }),
    'Do not invent geometry, do not output G-code, and do not override deterministic facts.',
    'Model/source warnings, planning warnings, manual override notes, and approval recommendation must remain clearly separated in your reasoning.',
    'Manual operations, disabled operations, and user-edited strategy text are draft overrides that must be reviewed but never treated as authoritative geometry.',
    'The payload below includes current draft state, model/source metadata, revision metadata, and manual overrides.',
    JSON.stringify(reviewContext(plan, options.context)),
  ].join('\n\n');

  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as unknown;
    const text = extractOutputText(payload);
    if (!text) {
      return fallback;
    }

    const parsed = camReviewSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return fallback;
    }

    return {
      ...parsed.data,
      mode: 'openai',
      fallbackUsed: false,
    };
  } catch {
    return fallback;
  }
}
