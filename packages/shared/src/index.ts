import { z } from 'zod';

const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().nonnegative();
const optionalId = z.string().min(1).optional();

const featureNameSchema = z.string().min(1);

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
});

export const contourSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  depthMm: positiveNumber,
});

export const pocketSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  widthMm: positiveNumber,
  depthMm: positiveNumber,
});

export const slotSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  widthMm: positiveNumber,
  depthMm: positiveNumber,
});

export const holeGroupSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  count: z.number().int().positive(),
  diameterMm: positiveNumber,
  depthMm: positiveNumber,
  pattern: z.enum(['line', 'rectangle', 'polar', 'custom']),
});

export const chamferSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  lengthMm: positiveNumber,
  sizeMm: positiveNumber,
});

export const engravingSchema = z.object({
  id: optionalId,
  name: featureNameSchema,
  text: z.string().min(1),
  lengthMm: positiveNumber,
  depthMm: positiveNumber,
});

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
});

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['face_mill', 'flat_end_mill', 'drill', 'chamfer_mill', 'engraver']),
  diameterMm: positiveNumber,
  maxDepthMm: positiveNumber,
  material: z.string().min(1),
});

export const operationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['face', 'profile', 'pocket', 'slot', 'drill', 'chamfer', 'engrave']),
  featureId: z.string().min(1),
  toolId: z.string().min(1),
  toolName: z.string().min(1),
  setup: z.string().min(1),
  strategy: z.string().min(1),
  estimatedMinutes: positiveNumber,
  enabled: z.boolean().default(true),
  origin: z.enum(['automatic', 'manual']).default('automatic'),
  order: z.number().int().nonnegative().default(0),
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

export const approvalStateSchema = z.object({
  state: z.enum(['draft', 'in_review', 'approved']),
  requiresHumanApproval: z.boolean(),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  notes: z.array(z.string()).default([]),
});

export const planSummarySchema = z.object({
  featureCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  highestRisk: riskLevelSchema,
});

export const selectedEntitySchema = z.object({
  type: z.enum(['feature', 'operation', 'risk', 'checklist', 'review', 'approval']),
  id: z.string().min(1),
});

export const draftCamPlanSchema = z.object({
  part: partInputSchema,
  features: z.array(normalizedFeatureSchema),
  operations: z.array(operationSchema),
  tools: z.array(toolSchema),
  risks: z.array(riskSchema),
  checklist: z.array(checklistItemSchema),
  estimatedCycleTimeMinutes: positiveNumber,
  approval: approvalStateSchema,
  assumptions: z.array(z.string()),
  summary: planSummarySchema,
});

export const camReviewSchema = z.object({
  mode: z.enum(['stub', 'openai']),
  missingOperations: z.array(z.string()),
  riskFlags: z.array(z.string()),
  suggestedEdits: z.array(z.string()),
  overallAssessment: z.string().min(1),
});

export const reviewRequestSchema = z.object({
  plan: draftCamPlanSchema,
});

export const projectDraftSchema = z.object({
  projectId: z.string().min(1),
  plan: draftCamPlanSchema,
  review: camReviewSchema.optional(),
  selectedEntity: selectedEntitySchema.optional(),
  savedAt: z.string().datetime().optional(),
});

export const approvalRequestSchema = z.object({
  plan: draftCamPlanSchema,
  approver: z.string().min(1),
  notes: z.string().min(1).optional(),
});

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

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalState = z.infer<typeof approvalStateSchema>;
export type CamReview = z.infer<typeof camReviewSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ContourInput = z.infer<typeof contourSchema>;
export type DraftCamPlan = z.infer<typeof draftCamPlanSchema>;
export type FeatureKind = z.infer<typeof featureKindSchema>;
export type HoleGroupInput = z.infer<typeof holeGroupSchema>;
export type NormalizedFeature = z.infer<typeof normalizedFeatureSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type PartInput = z.infer<typeof partInputSchema>;
export type PocketInput = z.infer<typeof pocketSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type SelectedEntity = z.infer<typeof selectedEntitySchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type Tool = z.infer<typeof toolSchema>;
