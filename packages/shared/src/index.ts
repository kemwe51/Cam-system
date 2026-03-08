import { z } from 'zod';

const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().nonnegative();
const optionalId = z.string().min(1).optional();
const isoDateTimeSchema = z.string().datetime();

const featureNameSchema = z.string().min(1);
const featureOriginSchema = z.enum(['structured', 'geometry_inferred']);
const featureClassificationStateSchema = z.enum(['automatic', 'manual_override', 'ignored']);

const featureSourceMetadataSchema = z.object({
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
  inferenceMethod: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(1),
  warnings: z.array(z.string()).default([]),
  origin: featureOriginSchema.default('structured'),
  classificationState: featureClassificationStateSchema.default('automatic'),
});

export const stockSchema = z.object({
  material: z.string().min(1),
  xMm: positiveNumber,
  yMm: positiveNumber,
  zMm: positiveNumber,
});

export const topSurfaceSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  areaMm2: positiveNumber,
  finish: z.enum(['as_stock', 'face_milled', 'ground']).default('face_milled'),
}).merge(featureSourceMetadataSchema);

export const contourSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  depthMm: positiveNumber,
}).merge(featureSourceMetadataSchema);

export const pocketSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  widthMm: positiveNumber,
  depthMm: positiveNumber,
}).merge(featureSourceMetadataSchema);

export const slotSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  widthMm: positiveNumber,
  depthMm: positiveNumber,
}).merge(featureSourceMetadataSchema);

export const holeGroupSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  count: z.number().int().positive(),
  diameterMm: positiveNumber,
  depthMm: positiveNumber,
  pattern: z.enum(['line', 'rectangle', 'polar', 'custom']),
}).merge(featureSourceMetadataSchema);

export const chamferSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  sizeMm: positiveNumber,
}).merge(featureSourceMetadataSchema);

export const engravingSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  text: z.string().min(1),
  lengthMm: positiveNumber,
  depthMm: positiveNumber,
}).merge(featureSourceMetadataSchema);

export const partInputSchema = z.object({
  partId: z.string().min(1),
  partName: z.string().min(1),
  revision: z.string().min(1),
  stock: stockSchema,
  topSurfaces: z.array(topSurfaceSchema).default([]),
  contours: z.array(contourSchema).default([]),
  pockets: z.array(pocketSchema).default([]),
  slots: z.array(slotSchema).default([]),
  holeGroups: z.array(holeGroupSchema).default([]),
  chamfers: z.array(chamferSchema).default([]),
  engraving: z.array(engravingSchema).default([]),
});

export const featureKindSchema = z.enum([
  'top_surface',
  'contour',
  'pocket',
  'slot',
  'hole_group',
  'chamfer',
  'engraving',
]);

export const riskLevelSchema = z.enum(['low', 'medium', 'high']);

export const normalizedFeatureSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  name: z.string().min(1),
  kind: featureKindSchema,
  quantity: z.number().int().positive(),
  depthMm: nonNegativeNumber,
  lengthMm: nonNegativeNumber,
  widthMm: nonNegativeNumber,
  areaMm2: nonNegativeNumber,
  notes: z.array(z.string()),
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
  inferenceMethod: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(1),
  warnings: z.array(z.string()).default([]),
  origin: featureOriginSchema.default('structured'),
  classificationState: featureClassificationStateSchema.default('automatic'),
});

export const toolTypeSchema = z.enum(['face_mill', 'flat_end_mill', 'drill', 'chamfer_mill', 'engraver']);

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: toolTypeSchema,
  diameterMm: positiveNumber,
  maxDepthMm: positiveNumber,
  material: z.string().min(1),
});

export const toolLibrarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tools: z.array(toolSchema).min(1),
});

export const machineProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  machineKind: z.enum(['3_axis_mill']).default('3_axis_mill'),
  travelsMm: z.object({
    x: positiveNumber,
    y: positiveNumber,
    z: positiveNumber,
  }),
  spindleMaxRpm: positiveNumber,
  coolant: z.boolean().default(true),
  notes: z.array(z.string()).default([]),
});

export const setupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  orientation: z.enum(['top', 'front', 'right', 'custom']).default('top'),
  workOffset: z.string().min(1),
  notes: z.array(z.string()).default([]),
});

export const operationKindSchema = z.enum(['face', 'profile', 'pocket', 'slot', 'drill', 'chamfer', 'engrave']);

export const operationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: operationKindSchema,
  featureId: z.string().min(1),
  toolId: z.string().min(1),
  toolName: z.string().min(1),
  setupId: z.string().min(1).default('setup-1'),
  setup: z.string().min(1),
  groupId: z.string().min(1).optional(),
  strategy: z.string().min(1),
  notes: z.string().default(''),
  estimatedMinutes: positiveNumber,
  enabled: z.boolean().default(true),
  origin: z.enum(['automatic', 'manual']).default('automatic'),
  order: z.number().int().nonnegative().default(0),
  isDirty: z.boolean().default(false),
});

export const operationGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['setup', 'feature']),
  setupId: z.string().min(1),
  featureId: z.string().min(1).optional(),
  operationIds: z.array(z.string().min(1)).default([]),
  expanded: z.boolean().default(true),
});

export const riskSchema = z.object({
  id: z.string().min(1),
  level: riskLevelSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  featureId: z.string().min(1).optional(),
});

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(['pending', 'done']).default('pending'),
});

export const approvalStateValueSchema = z.enum(['draft', 'in_review', 'approved']);

export const approvalStateSchema = z.object({
  state: approvalStateValueSchema,
  requiresHumanApproval: z.boolean(),
  approvedBy: z.string().min(1).optional(),
  approvedAt: isoDateTimeSchema.optional(),
  notes: z.array(z.string()).default([]),
});

export const planSummarySchema = z.object({
  featureCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  enabledOperationCount: z.number().int().nonnegative().default(0),
  manualOperationCount: z.number().int().nonnegative().default(0),
  highestRisk: riskLevelSchema,
});

export const selectedEntitySchema = z.object({
  type: z.enum(['feature', 'operation', 'risk', 'checklist', 'review', 'approval', 'tool', 'project', 'geometry']),
  id: z.string().min(1),
});

export const draftCamPlanSchema = z.object({
  part: partInputSchema,
  machineProfile: machineProfileSchema,
  setups: z.array(setupSchema).min(1),
  features: z.array(normalizedFeatureSchema),
  operationGroups: z.array(operationGroupSchema).default([]),
  operations: z.array(operationSchema),
  toolLibrary: toolLibrarySchema,
  tools: z.array(toolSchema),
  risks: z.array(riskSchema),
  checklist: z.array(checklistItemSchema),
  estimatedCycleTimeMinutes: positiveNumber,
  approval: approvalStateSchema,
  assumptions: z.array(z.string()),
  summary: planSummarySchema,
});

export const approvalRecommendationSchema = z.enum(['hold', 'review', 'approve_with_human_signoff']);

export const camReviewSchema = z.object({
  mode: z.enum(['stub', 'openai']),
  missingOperations: z.array(z.string()),
  riskFlags: z.array(z.string()),
  suggestedEdits: z.array(z.string()),
  overallAssessment: z.string().min(1),
  approvalRecommendation: approvalRecommendationSchema.default('review'),
  fallbackUsed: z.boolean().default(false),
});

export const reviewRequestSchema = z.object({
  plan: draftCamPlanSchema,
});

export const projectMetadataSchema = z.object({
  projectId: z.string().min(1),
  partId: z.string().min(1),
  partName: z.string().min(1),
  revision: z.string().min(1),
  updatedAt: isoDateTimeSchema,
  approvalState: approvalStateValueSchema,
  dirty: z.boolean().default(false),
});

export const projectSummarySchema = projectMetadataSchema;

export const projectDraftSchema = z.object({
  projectId: z.string().min(1),
  metadata: projectMetadataSchema.optional(),
  plan: draftCamPlanSchema,
  review: camReviewSchema.optional(),
  selectedEntity: selectedEntitySchema.optional(),
  savedAt: isoDateTimeSchema.optional(),
});

export const approvalRequestSchema = z.object({
  plan: draftCamPlanSchema,
  approver: z.string().min(1),
  notes: z.string().min(1).optional(),
});

export const defaultMachineProfile = machineProfileSchema.parse({
  id: 'machine-vmc-3x-default',
  name: 'Default 3-axis VMC',
  machineKind: '3_axis_mill',
  travelsMm: {
    x: 500,
    y: 400,
    z: 300,
  },
  spindleMaxRpm: 12000,
  coolant: true,
  notes: [
    'Foundational machine profile only. No kinematics, probing, or machine simulation is implemented yet.',
  ],
});

export const defaultToolLibrary = toolLibrarySchema.parse({
  id: 'library-default-v1',
  name: 'Default foundational tool library',
  tools: [
    {
      id: 'tool-face-16',
      name: '16 mm face mill',
      type: 'face_mill',
      diameterMm: 16,
      maxDepthMm: 2,
      material: 'carbide',
    },
    {
      id: 'tool-flat-10',
      name: '10 mm flat end mill',
      type: 'flat_end_mill',
      diameterMm: 10,
      maxDepthMm: 18,
      material: 'carbide',
    },
    {
      id: 'tool-flat-6',
      name: '6 mm flat end mill',
      type: 'flat_end_mill',
      diameterMm: 6,
      maxDepthMm: 20,
      material: 'carbide',
    },
    {
      id: 'tool-drill-6',
      name: '6 mm carbide drill',
      type: 'drill',
      diameterMm: 6,
      maxDepthMm: 24,
      material: 'carbide',
    },
    {
      id: 'tool-drill-3',
      name: '3 mm carbide drill',
      type: 'drill',
      diameterMm: 3,
      maxDepthMm: 12,
      material: 'carbide',
    },
    {
      id: 'tool-chamfer-12',
      name: '12 mm chamfer mill',
      type: 'chamfer_mill',
      diameterMm: 12,
      maxDepthMm: 3,
      material: 'carbide',
    },
    {
      id: 'tool-engrave-02',
      name: '0.2 mm engraving tool',
      type: 'engraver',
      diameterMm: 0.2,
      maxDepthMm: 1,
      material: 'carbide',
    },
  ],
});

export const defaultSetups = setupSchema.array().parse([
  {
    id: 'setup-1',
    name: 'Setup 1 / Top side',
    orientation: 'top',
    workOffset: 'G54',
    notes: ['Single-sided foundational setup. Additional setups remain manual workbench authoring for now.'],
  },
]);

export function getSetupLabel(setups: Setup[], setupId: string, fallback = 'Setup 1 / Top side'): string {
  return setups.find((setup) => setup.id === setupId)?.name ?? fallback;
}

export function buildOperationGroupId(setupId: string, featureId?: string): string {
  return featureId ? `group-${setupId}-${featureId}` : `group-${setupId}`;
}

export function buildOperationGroups(operations: Operation[], features: NormalizedFeature[]): OperationGroup[] {
  const featureMap = new Map(features.map((feature) => [feature.id, feature]));
  const groups = new Map<string, OperationGroup>();

  operations.forEach((operation) => {
    const groupId = operation.groupId ?? buildOperationGroupId(operation.setupId, operation.featureId);
    const feature = featureMap.get(operation.featureId);
    const existing = groups.get(groupId);

    if (existing) {
      existing.operationIds.push(operation.id);
      return;
    }

    groups.set(groupId, {
      id: groupId,
      name: feature ? `${operation.setup} · ${feature.name}` : operation.setup,
      kind: feature ? 'feature' : 'setup',
      setupId: operation.setupId,
      ...(feature ? { featureId: feature.id } : {}),
      operationIds: [operation.id],
      expanded: true,
    });
  });

  return [...groups.values()];
}

export function buildProjectMetadata(
  projectId: string,
  plan: DraftCamPlan,
  updatedAt = new Date().toISOString(),
  dirty = false,
): ProjectMetadata {
  return projectMetadataSchema.parse({
    projectId,
    partId: plan.part.partId,
    partName: plan.part.partName,
    revision: plan.part.revision,
    updatedAt,
    approvalState: plan.approval.state,
    dirty,
  });
}

export const samplePartInput = partInputSchema.parse({
  partId: 'demo-bracket-001',
  partName: 'Demo Motor Bracket',
  revision: 'A',
  stock: {
    material: 'Aluminum 6061',
    xMm: 120,
    yMm: 80,
    zMm: 25,
  },
  topSurfaces: [
    {
      id: 'top-1',
      name: 'Main top surface',
      areaMm2: 9600,
      finish: 'face_milled',
    },
  ],
  contours: [
    {
      id: 'contour-1',
      name: 'Outer profile',
      lengthMm: 360,
      depthMm: 8,
    },
  ],
  pockets: [
    {
      id: 'pocket-1',
      name: 'Center relief pocket',
      lengthMm: 50,
      widthMm: 30,
      depthMm: 14,
    },
  ],
  slots: [
    {
      id: 'slot-1',
      name: 'Cable slot',
      lengthMm: 45,
      widthMm: 4,
      depthMm: 6,
    },
  ],
  holeGroups: [
    {
      id: 'holes-1',
      name: 'Mounting hole group',
      count: 4,
      diameterMm: 6,
      depthMm: 18,
      pattern: 'rectangle',
    },
  ],
  chamfers: [
    {
      id: 'chamfer-1',
      name: 'Outer edge break',
      lengthMm: 360,
      sizeMm: 1,
    },
  ],
  engraving: [
    {
      id: 'engrave-1',
      name: 'Part mark',
      text: 'BRKT-A',
      lengthMm: 24,
      depthMm: 0.3,
    },
  ],
});

export type ApprovalRecommendation = z.infer<typeof approvalRecommendationSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalState = z.infer<typeof approvalStateSchema>;
export type ApprovalStateValue = z.infer<typeof approvalStateValueSchema>;
export type CamReview = z.infer<typeof camReviewSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ContourInput = z.infer<typeof contourSchema>;
export type DraftCamPlan = z.infer<typeof draftCamPlanSchema>;
export type FeatureKind = z.infer<typeof featureKindSchema>;
export type HoleGroupInput = z.infer<typeof holeGroupSchema>;
export type MachineProfile = z.infer<typeof machineProfileSchema>;
export type NormalizedFeature = z.infer<typeof normalizedFeatureSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type OperationGroup = z.infer<typeof operationGroupSchema>;
export type OperationKind = z.infer<typeof operationKindSchema>;
export type PartInput = z.infer<typeof partInputSchema>;
export type PocketInput = z.infer<typeof pocketSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type SelectedEntity = z.infer<typeof selectedEntitySchema>;
export type Setup = z.infer<typeof setupSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolLibrary = z.infer<typeof toolLibrarySchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
