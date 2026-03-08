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

export const setupPlaneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  orientation: z.enum(['top', 'front', 'right', 'custom']).default('top'),
});

export const workOffsetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  code: z.string().min(1),
});

export const setupOrientationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  orientation: z.enum(['top', 'front', 'right', 'custom']).default('top'),
  rotationDegrees: z.object({
    a: z.number().default(0),
    b: z.number().default(0),
    c: z.number().default(0),
  }).default({
    a: 0,
    b: 0,
    c: 0,
  }),
  note: z.string().min(1).optional(),
});

export const machineCoordinateReferenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['machine_zero', 'work_offset_zero', 'stock_top']).default('work_offset_zero'),
  axesAlignedToSetup: z.boolean().default(true),
  note: z.string().min(1).optional(),
});

export const clearanceReferenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['safe_clearance', 'retract_plane', 'stock_top']).default('safe_clearance'),
  zMm: nonNegativeNumber,
});

export const stockReferenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  topZMm: z.number(),
  bottomZMm: z.number().optional(),
  material: z.string().min(1).optional(),
});

export const setupWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  reviewRequired: z.boolean().default(true),
});

export const setupReferenceSchema = z.object({
  setupPlane: setupPlaneSchema,
  workOffset: workOffsetSchema,
});

export const zReferenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['stock_top', 'setup_zero', 'feature_top', 'feature_floor', 'safe_clearance', 'unknown']),
  label: z.string().min(1),
  zMm: z.number(),
});

export const depthRangeSchema = z.object({
  topZMm: z.number(),
  bottomZMm: z.number(),
}).refine((value) => value.bottomZMm <= value.topZMm, {
  path: ['bottomZMm'],
  message: 'bottomZMm must be less than or equal to topZMm.',
});

export const machiningLevelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reference: zReferenceSchema,
  zMm: z.number(),
});

export const stockTopSchema = z.object({
  reference: zReferenceSchema,
  zMm: z.number(),
});

export const stockBottomSchema = z.object({
  reference: zReferenceSchema,
  zMm: z.number(),
});

export const floorLevelSchema = z.object({
  reference: zReferenceSchema,
  zMm: z.number(),
});

export const passDepthHintSchema = z.object({
  axialStepDownMm: positiveNumber,
  basis: z.enum(['feature_depth', 'tool_capacity', 'manual_hint', 'assumed']).default('feature_depth'),
});

export const safeClearanceSchema = z.object({
  reference: zReferenceSchema,
  zMm: nonNegativeNumber,
});

export const retractPlaneSchema = z.object({
  reference: zReferenceSchema,
  zMm: nonNegativeNumber,
});

export const depthKnowledgeSchema = z.enum(['known', 'inferred', 'assumed', 'unknown']);

export const unknownDepthReasonSchema = z.enum([
  'not_provided',
  'dxf_2d_only',
  'ambiguous_region',
  'open_region',
  'hole_callout_missing',
  'manual_review_required',
]);

export const topReferenceSchema = z.object({
  reference: zReferenceSchema,
  source: depthKnowledgeSchema.default('known'),
});

export const bottomReferenceSchema = z.object({
  reference: zReferenceSchema,
  source: depthKnowledgeSchema.default('known'),
  behavior: z.enum(['floor', 'through', 'blind', 'unknown']).default('unknown'),
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

export const featureClassificationSchema = z.enum([
  'outside_contour',
  'inside_contour',
  'pocket',
  'hole_group',
  'slot',
  'engraving',
  'unclassified',
  'ignored',
]);

export const riskLevelSchema = z.enum(['low', 'medium', 'high']);

export const depthAssumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(['structured_input', 'import_default', 'manual_override', 'unknown']).default('unknown'),
  reviewRequired: z.boolean().default(true),
});

export const depthWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: riskLevelSchema.default('medium'),
  reviewRequired: z.boolean().default(true),
});

export const machiningIntentSchema = z.object({
  featureId: z.string().min(1),
  classification: featureClassificationSchema,
  confidence: z.number().min(0).max(1).default(1),
  requiresReview: z.boolean().default(false),
  rationale: z.string().min(1),
  source: z.enum(['structured', 'extracted_feature', 'manual_override']).default('structured'),
});

export const featureDepthModelSchema = z.object({
  setupPlane: setupPlaneSchema,
  setupReference: setupReferenceSchema.optional(),
  stockTop: stockTopSchema,
  stockBottom: stockBottomSchema.optional(),
  topReference: topReferenceSchema.optional(),
  bottomReference: bottomReferenceSchema.optional(),
  floorLevel: floorLevelSchema.optional(),
  depthRange: depthRangeSchema.optional(),
  depthStatus: depthKnowledgeSchema.default('known'),
  unknownDepthReason: unknownDepthReasonSchema.optional(),
  machiningLevels: z.array(machiningLevelSchema).default([]),
  assumptions: z.array(depthAssumptionSchema).default([]),
  warnings: z.array(depthWarningSchema).default([]),
});

export const regionDepthModelSchema = featureDepthModelSchema.extend({
  regionType: z.enum(['contour', 'pocket', 'slot']),
  openRegion: z.boolean().default(false),
});

export const holeDepthModelSchema = featureDepthModelSchema.extend({
  holeType: z.enum(['through', 'blind', 'unknown']).default('unknown'),
  pattern: z.enum(['line', 'rectangle', 'polar', 'custom']).optional(),
  diameterMm: positiveNumber.optional(),
});

export const depthFieldSourceSchema = z.enum(['generated', 'assumed', 'manual_override']);

export const depthFieldStatesSchema = z.object({
  targetDepth: depthFieldSourceSchema.optional(),
  topReference: depthFieldSourceSchema.optional(),
  floorLevel: depthFieldSourceSchema.optional(),
  bottomBehavior: depthFieldSourceSchema.optional(),
  safeClearance: depthFieldSourceSchema.optional(),
  retractPlane: depthFieldSourceSchema.optional(),
  passDepthPlan: depthFieldSourceSchema.optional(),
});

export const passDepthPlanSchema = z.object({
  roughingLayerCount: z.number().int().positive().default(1),
  maxStepDownMm: positiveNumber,
  finishPass: z.enum(['none', 'floor', 'wall', 'wall_and_floor', 'profile_cleanup']).default('none'),
  retractTo: z.enum(['safe_clearance', 'retract_plane', 'feature_top']).default('safe_clearance'),
  note: z.string().min(1),
});

export const operationDepthProfileSchema = z.object({
  setupPlane: setupPlaneSchema,
  setupReference: setupReferenceSchema.optional(),
  stockTop: stockTopSchema.optional(),
  stockBottom: stockBottomSchema.optional(),
  topReference: topReferenceSchema.optional(),
  bottomReference: bottomReferenceSchema.optional(),
  floorLevel: floorLevelSchema.optional(),
  depthRange: depthRangeSchema.optional(),
  targetDepthMm: nonNegativeNumber.optional(),
  depthStatus: depthKnowledgeSchema.default('known'),
  unknownDepthReason: unknownDepthReasonSchema.optional(),
  passDepthHint: passDepthHintSchema.optional(),
  passDepthPlan: passDepthPlanSchema.optional(),
  safeClearance: safeClearanceSchema.optional(),
  retractPlane: retractPlaneSchema.optional(),
  fieldSources: depthFieldStatesSchema.default({}),
  overridePreserved: z.boolean().default(false),
  assumptions: z.array(depthAssumptionSchema).default([]),
  warnings: z.array(depthWarningSchema).default([]),
});

export const toolClassSchema = z.enum([
  'face_mill',
  'contour_end_mill',
  'pocket_end_mill',
  'small_slot_end_mill',
  'drill',
  'chamfer_tool',
  'engraving_tool',
]);

const previewPointSchema = z.tuple([z.number(), z.number(), z.number()]);

export const previewPathSegmentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['line', 'arc', 'marker', 'region', 'centerline']),
  points: z.array(previewPointSchema).min(1),
  closed: z.boolean().default(false),
  label: z.string().min(1).optional(),
  depthAnnotation: z.string().min(1).optional(),
  motionType: z.enum(['rapid_move', 'feed_move', 'plunge_move', 'retract_move']).optional(),
  pathPlanId: z.string().min(1).optional(),
  pathSegmentId: z.string().min(1).optional(),
});

export const previewPathSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  featureId: z.string().min(1),
  kind: z.literal('operation_preview').default('operation_preview'),
  label: z.string().min(1),
  segments: z.array(previewPathSegmentSchema).default([]),
  source: z.enum(['generated', 'manual']).default('generated'),
});

export const pathMotionTypeSchema = z.enum(['rapid_move', 'feed_move', 'plunge_move', 'retract_move']);

export const entryStrategySchema = z.enum(['direct_plunge', 'linear_ramp', 'helical_ramp', 'pre_drill', 'none']);

export const exitStrategySchema = z.enum(['linear_exit', 'tangent_exit', 'direct_retract', 'none']);

export const clearanceStrategySchema = z.enum(['safe_clearance', 'retract_plane', 'feature_top']);

export const pathDirectionHintSchema = z.enum(['cw', 'ccw', 'climb', 'conventional', 'left_to_right', 'center_out']);

export const pathPreviewModeSchema = z.enum(['summary', 'candidate_segments', 'entry_exit', 'full_path_plan']);

export const pathOrderingHintSchema = z.object({
  mode: z.enum(['feature_order', 'nearest_neighbor', 'loop_priority', 'pattern_group']),
  direction: pathDirectionHintSchema.optional(),
  note: z.string().min(1).optional(),
});

export const pathPlanWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  reviewRequired: z.boolean().default(true),
});

export const pathPlanAssumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  reviewRequired: z.boolean().default(true),
});

const pathPlanPointSchema = z.tuple([z.number(), z.number(), z.number()]);

const pathPlanSegmentBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  motionType: pathMotionTypeSchema,
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
});

export const linearPathSegmentSchema = pathPlanSegmentBaseSchema.extend({
  kind: z.literal('linear'),
  points: z.tuple([pathPlanPointSchema, pathPlanPointSchema]),
});

export const arcPathSegmentSchema = pathPlanSegmentBaseSchema.extend({
  kind: z.literal('arc'),
  points: z.array(pathPlanPointSchema).min(2),
  centerPoint: pathPlanPointSchema,
  radiusMm: positiveNumber,
  clockwise: z.boolean(),
});

export const rapidMoveSchema = linearPathSegmentSchema.extend({
  motionType: z.literal('rapid_move'),
});

export const feedMoveSchema = linearPathSegmentSchema.extend({
  motionType: z.literal('feed_move'),
});

export const plungeMoveSchema = linearPathSegmentSchema.extend({
  motionType: z.literal('plunge_move'),
});

export const retractMoveSchema = linearPathSegmentSchema.extend({
  motionType: z.literal('retract_move'),
});

export const pathPlanSegmentSchema = z.union([
  rapidMoveSchema,
  feedMoveSchema,
  plungeMoveSchema,
  retractMoveSchema,
  linearPathSegmentSchema,
  arcPathSegmentSchema,
]);

export const leadInPlanSchema = z.object({
  strategy: entryStrategySchema,
  segmentIds: z.array(z.string().min(1)).default([]),
  note: z.string().min(1).optional(),
});

export const leadOutPlanSchema = z.object({
  strategy: exitStrategySchema,
  segmentIds: z.array(z.string().min(1)).default([]),
  note: z.string().min(1).optional(),
});

export const pathPlanSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  featureId: z.string().min(1),
  label: z.string().min(1),
  intent: z.enum(['roughing', 'finishing', 'single_pass', 'drilling', 'slotting']).default('single_pass'),
  coordinateReference: z.enum(['feature_normalized', 'setup_top']).default('feature_normalized'),
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
  entryStrategy: entryStrategySchema.default('none'),
  exitStrategy: exitStrategySchema.default('none'),
  clearanceStrategy: clearanceStrategySchema.default('safe_clearance'),
  retractStrategy: clearanceStrategySchema.default('safe_clearance'),
  pathDirectionHint: pathDirectionHintSchema.optional(),
  orderingHint: pathOrderingHintSchema.optional(),
  leadIn: leadInPlanSchema.optional(),
  leadOut: leadOutPlanSchema.optional(),
  topReferenceZMm: z.number().optional(),
  targetDepthMm: nonNegativeNumber.optional(),
  clearanceZMm: nonNegativeNumber.optional(),
  retractZMm: nonNegativeNumber.optional(),
  passDepthPlan: passDepthPlanSchema.optional(),
  segments: z.array(pathPlanSegmentSchema).default([]),
  warnings: z.array(pathPlanWarningSchema).default([]),
  assumptions: z.array(pathPlanAssumptionSchema).default([]),
});

export const pathPlanningFieldSourceSchema = z.enum(['generated', 'assumed', 'manual_override']);

export const pathPlanningFieldStatesSchema = z.object({
  entryStrategy: pathPlanningFieldSourceSchema.optional(),
  exitStrategy: pathPlanningFieldSourceSchema.optional(),
  clearanceStrategy: pathPlanningFieldSourceSchema.optional(),
  retractStrategy: pathPlanningFieldSourceSchema.optional(),
  pathDirectionHint: pathPlanningFieldSourceSchema.optional(),
  pathOrderingHint: pathPlanningFieldSourceSchema.optional(),
});

export const operationPathProfileSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  featureId: z.string().min(1),
  previewMode: pathPreviewModeSchema.default('candidate_segments'),
  setupId: z.string().min(1),
  workOffset: workOffsetSchema.optional(),
  machineCoordinateReference: machineCoordinateReferenceSchema.optional(),
  clearanceReference: clearanceReferenceSchema.optional(),
  stockReference: stockReferenceSchema.optional(),
  entryStrategy: entryStrategySchema.default('none'),
  exitStrategy: exitStrategySchema.default('none'),
  clearanceStrategy: clearanceStrategySchema.default('safe_clearance'),
  retractStrategy: clearanceStrategySchema.default('safe_clearance'),
  pathDirectionHint: pathDirectionHintSchema.optional(),
  pathOrderingHint: pathOrderingHintSchema.optional(),
  fieldSources: pathPlanningFieldStatesSchema.default({}),
  overridePreserved: z.boolean().default(false),
  pathPlans: z.array(pathPlanSchema).default([]),
  warnings: z.array(pathPlanWarningSchema).default([]),
  assumptions: z.array(pathPlanAssumptionSchema).default([]),
});

export const toolSelectionReasonSchema = z.object({
  toolClass: toolClassSchema,
  reason: z.string().min(1),
  ruleId: z.string().min(1).optional(),
  diameterBasisMm: nonNegativeNumber.optional(),
  depthBasisMm: nonNegativeNumber.optional(),
  warnings: z.array(z.string().min(1)).default([]),
  weakMatch: z.boolean().default(false),
});

export const planningWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: riskLevelSchema.default('medium'),
  reviewRequired: z.boolean().default(true),
});

export const machiningAssumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  reviewRequired: z.boolean().default(true),
});

export const operationLinkSchema = z.object({
  featureId: z.string().min(1),
  extractedFeatureId: z.string().min(1).optional(),
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
});

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
  machiningIntent: machiningIntentSchema.optional(),
  depthModel: featureDepthModelSchema.optional(),
});

export const toolTypeSchema = z.enum(['face_mill', 'flat_end_mill', 'drill', 'chamfer_mill', 'engraver']);

export const toolHolderSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  gaugeLengthMm: positiveNumber.optional(),
});

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: toolTypeSchema,
  diameterMm: positiveNumber,
  maxDepthMm: positiveNumber,
  material: z.string().min(1),
  supportedToolClasses: z.array(toolClassSchema).default([]),
  holder: toolHolderSummarySchema.optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const toolDefinitionSchema = toolSchema;

export const toolLibrarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tools: z.array(toolSchema).min(1),
});

export const toolingAssumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  reviewRequired: z.boolean().default(true),
});

export const toolingWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: riskLevelSchema.default('medium'),
  reviewRequired: z.boolean().default(true),
});

export const toolSelectionRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  toolClass: toolClassSchema,
  rationale: z.string().min(1),
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
  orientationDefinition: setupOrientationSchema.optional(),
  workOffsetDefinition: workOffsetSchema.optional(),
  machineCoordinateReference: machineCoordinateReferenceSchema.optional(),
  clearanceReference: clearanceReferenceSchema.optional(),
  stockReference: stockReferenceSchema.optional(),
  warnings: z.array(setupWarningSchema).default([]),
  notes: z.array(z.string()).default([]),
});

export const operationKindSchema = z.enum(['face', 'profile', 'pocket', 'slot', 'drill', 'chamfer', 'engrave']);

export const operationCandidateSchema = z.object({
  id: z.string().min(1),
  featureId: z.string().min(1),
  kind: operationKindSchema,
  name: z.string().min(1),
  strategy: z.string().min(1),
  toolClass: toolClassSchema,
  estimatedMinutes: positiveNumber,
  warnings: z.array(planningWarningSchema).default([]),
  assumptions: z.array(machiningAssumptionSchema).default([]),
  machiningIntent: machiningIntentSchema,
});

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
  source: z.enum(['generated', 'manual', 'edited']).default('generated'),
  order: z.number().int().nonnegative().default(0),
  isDirty: z.boolean().default(false),
  frozen: z.boolean().default(false),
  toolClass: toolClassSchema.optional(),
  toolSelectionReason: toolSelectionReasonSchema.optional(),
  machiningIntent: machiningIntentSchema.optional(),
  depthProfile: operationDepthProfileSchema.optional(),
  pathProfile: operationPathProfileSchema.optional(),
  links: z.array(operationLinkSchema).default([]),
  warnings: z.array(planningWarningSchema).default([]),
  assumptions: z.array(machiningAssumptionSchema).default([]),
});

export const generatedOperationSchema = operationSchema.extend({
  origin: z.literal('automatic'),
  source: z.literal('generated'),
});

export const operationGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['setup', 'feature', 'operation_type']),
  setupId: z.string().min(1),
  featureId: z.string().min(1).optional(),
  category: z.enum(['Contours', 'Holes', 'Pockets', 'Slots', 'Manual', 'Other']).optional(),
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
      supportedToolClasses: ['face_mill'],
      holder: {
        id: 'holder-shell-face',
        label: 'Face mill arbor',
      },
      notes: ['Foundational facing tool only. Feeds and holder clearance are still manual review items.'],
    },
    {
      id: 'tool-flat-10',
      name: '10 mm flat end mill',
      type: 'flat_end_mill',
      diameterMm: 10,
      maxDepthMm: 18,
      material: 'carbide',
      supportedToolClasses: ['contour_end_mill', 'pocket_end_mill'],
      holder: {
        id: 'holder-er32-short',
        label: 'ER32 short holder',
        gaugeLengthMm: 55,
      },
    },
    {
      id: 'tool-flat-6',
      name: '6 mm flat end mill',
      type: 'flat_end_mill',
      diameterMm: 6,
      maxDepthMm: 20,
      material: 'carbide',
      supportedToolClasses: ['contour_end_mill', 'pocket_end_mill'],
      holder: {
        id: 'holder-er25-mid',
        label: 'ER25 medium holder',
        gaugeLengthMm: 60,
      },
    },
    {
      id: 'tool-slot-3',
      name: '3 mm slot end mill',
      type: 'flat_end_mill',
      diameterMm: 3,
      maxDepthMm: 10,
      material: 'carbide',
      supportedToolClasses: ['small_slot_end_mill'],
      holder: {
        id: 'holder-er16-long',
        label: 'ER16 long holder',
        gaugeLengthMm: 65,
      },
      notes: ['Use conservatively for narrow slot planning only.'],
    },
    {
      id: 'tool-drill-6',
      name: '6 mm carbide drill',
      type: 'drill',
      diameterMm: 6,
      maxDepthMm: 24,
      material: 'carbide',
      supportedToolClasses: ['drill'],
    },
    {
      id: 'tool-drill-3',
      name: '3 mm carbide drill',
      type: 'drill',
      diameterMm: 3,
      maxDepthMm: 12,
      material: 'carbide',
      supportedToolClasses: ['drill'],
    },
    {
      id: 'tool-chamfer-12',
      name: '12 mm chamfer mill',
      type: 'chamfer_mill',
      diameterMm: 12,
      maxDepthMm: 3,
      material: 'carbide',
      supportedToolClasses: ['chamfer_tool'],
    },
    {
      id: 'tool-engrave-02',
      name: '0.2 mm engraving tool',
      type: 'engraver',
      diameterMm: 0.2,
      maxDepthMm: 1,
      material: 'carbide',
      supportedToolClasses: ['engraving_tool'],
    },
  ],
});

export const defaultSetups = setupSchema.array().parse([
  {
    id: 'setup-1',
    name: 'Setup 1 / Top side',
    orientation: 'top',
    workOffset: 'G54',
    orientationDefinition: {
      id: 'setup-orientation-top',
      label: 'Top setup orientation',
      orientation: 'top',
      rotationDegrees: {
        a: 0,
        b: 0,
        c: 0,
      },
      note: 'Initial path-planning foundation assumes the top-side setup only.',
    },
    workOffsetDefinition: {
      id: 'work-offset-g54',
      label: 'Primary work offset',
      code: 'G54',
    },
    machineCoordinateReference: {
      id: 'machine-reference-g54',
      label: 'Primary work offset zero',
      kind: 'work_offset_zero',
      axesAlignedToSetup: true,
      note: 'Foundational setup reference only. No machine simulation or post data is implied.',
    },
    clearanceReference: {
      id: 'setup-1-clearance',
      label: 'Top setup clearance',
      kind: 'safe_clearance',
      zMm: 5,
    },
    stockReference: {
      id: 'setup-1-stock',
      label: 'Setup 1 stock envelope',
      topZMm: 0,
    },
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
export type DepthAssumption = z.infer<typeof depthAssumptionSchema>;
export type DepthFieldSource = z.infer<typeof depthFieldSourceSchema>;
export type DepthFieldStates = z.infer<typeof depthFieldStatesSchema>;
export type DepthKnowledge = z.infer<typeof depthKnowledgeSchema>;
export type DepthRange = z.infer<typeof depthRangeSchema>;
export type DepthWarning = z.infer<typeof depthWarningSchema>;
export type DraftCamPlan = z.infer<typeof draftCamPlanSchema>;
export type FeatureDepthModel = z.infer<typeof featureDepthModelSchema>;
export type FeatureKind = z.infer<typeof featureKindSchema>;
export type FeatureClassification = z.infer<typeof featureClassificationSchema>;
export type FloorLevel = z.infer<typeof floorLevelSchema>;
export type HoleGroupInput = z.infer<typeof holeGroupSchema>;
export type HoleDepthModel = z.infer<typeof holeDepthModelSchema>;
export type MachineProfile = z.infer<typeof machineProfileSchema>;
export type MachiningLevel = z.infer<typeof machiningLevelSchema>;
export type MachiningAssumption = z.infer<typeof machiningAssumptionSchema>;
export type MachiningIntent = z.infer<typeof machiningIntentSchema>;
export type NormalizedFeature = z.infer<typeof normalizedFeatureSchema>;
export type GeneratedOperation = z.infer<typeof generatedOperationSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type OperationCandidate = z.infer<typeof operationCandidateSchema>;
export type OperationDepthProfile = z.infer<typeof operationDepthProfileSchema>;
export type OperationPathProfile = z.infer<typeof operationPathProfileSchema>;
export type OperationGroup = z.infer<typeof operationGroupSchema>;
export type OperationKind = z.infer<typeof operationKindSchema>;
export type OperationLink = z.infer<typeof operationLinkSchema>;
export type PartInput = z.infer<typeof partInputSchema>;
export type PassDepthHint = z.infer<typeof passDepthHintSchema>;
export type PassDepthPlan = z.infer<typeof passDepthPlanSchema>;
export type PlanningWarning = z.infer<typeof planningWarningSchema>;
export type PocketInput = z.infer<typeof pocketSchema>;
export type PathDirectionHint = z.infer<typeof pathDirectionHintSchema>;
export type PathMotionType = z.infer<typeof pathMotionTypeSchema>;
export type PathOrderingHint = z.infer<typeof pathOrderingHintSchema>;
export type PathPlan = z.infer<typeof pathPlanSchema>;
export type PathPlanAssumption = z.infer<typeof pathPlanAssumptionSchema>;
export type PathPlanSegment = z.infer<typeof pathPlanSegmentSchema>;
export type PathPlanWarning = z.infer<typeof pathPlanWarningSchema>;
export type PathPlanningFieldSource = z.infer<typeof pathPlanningFieldSourceSchema>;
export type PathPlanningFieldStates = z.infer<typeof pathPlanningFieldStatesSchema>;
export type PathPreviewMode = z.infer<typeof pathPreviewModeSchema>;
export type PreviewPath = z.infer<typeof previewPathSchema>;
export type PreviewPathSegment = z.infer<typeof previewPathSegmentSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type SafeClearance = z.infer<typeof safeClearanceSchema>;
export type SelectedEntity = z.infer<typeof selectedEntitySchema>;
export type Setup = z.infer<typeof setupSchema>;
export type SetupDefinition = z.infer<typeof setupSchema>;
export type SetupOrientation = z.infer<typeof setupOrientationSchema>;
export type SetupPlane = z.infer<typeof setupPlaneSchema>;
export type SetupReference = z.infer<typeof setupReferenceSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type StockTop = z.infer<typeof stockTopSchema>;
export type StockBottom = z.infer<typeof stockBottomSchema>;
export type RegionDepthModel = z.infer<typeof regionDepthModelSchema>;
export type RetractPlane = z.infer<typeof retractPlaneSchema>;
export type TopReference = z.infer<typeof topReferenceSchema>;
export type BottomReference = z.infer<typeof bottomReferenceSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolClass = z.infer<typeof toolClassSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ToolHolderSummary = z.infer<typeof toolHolderSummarySchema>;
export type ToolLibrary = z.infer<typeof toolLibrarySchema>;
export type ToolingAssumption = z.infer<typeof toolingAssumptionSchema>;
export type ToolingWarning = z.infer<typeof toolingWarningSchema>;
export type ToolSelectionReason = z.infer<typeof toolSelectionReasonSchema>;
export type ToolSelectionRule = z.infer<typeof toolSelectionRuleSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type UnknownDepthReason = z.infer<typeof unknownDepthReasonSchema>;
export type MachineCoordinateReference = z.infer<typeof machineCoordinateReferenceSchema>;
export type ClearanceReference = z.infer<typeof clearanceReferenceSchema>;
export type StockReference = z.infer<typeof stockReferenceSchema>;
export type SetupWarning = z.infer<typeof setupWarningSchema>;
export type WorkOffset = z.infer<typeof workOffsetSchema>;
export type ZReference = z.infer<typeof zReferenceSchema>;
export type LeadInPlan = z.infer<typeof leadInPlanSchema>;
export type LeadOutPlan = z.infer<typeof leadOutPlanSchema>;
export type LinearPathSegment = z.infer<typeof linearPathSegmentSchema>;
export type ArcPathSegment = z.infer<typeof arcPathSegmentSchema>;
export type RapidMove = z.infer<typeof rapidMoveSchema>;
export type FeedMove = z.infer<typeof feedMoveSchema>;
export type PlungeMove = z.infer<typeof plungeMoveSchema>;
export type RetractMove = z.infer<typeof retractMoveSchema>;
export type EntryStrategy = z.infer<typeof entryStrategySchema>;
export type ExitStrategy = z.infer<typeof exitStrategySchema>;
export type ClearanceStrategy = z.infer<typeof clearanceStrategySchema>;
