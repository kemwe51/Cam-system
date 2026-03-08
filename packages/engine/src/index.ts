import {
  approvalRequestSchema,
  buildOperationGroupId,
  buildOperationGroups,
  defaultMachineProfile,
  defaultSetups,
  defaultToolLibrary,
  depthAssumptionSchema,
  depthWarningSchema,
  draftCamPlanSchema,
  featureDepthModelSchema,
  featureClassificationSchema,
  getSetupLabel,
  machiningAssumptionSchema,
  machiningIntentSchema,
  operationCandidateSchema,
  operationDepthProfileSchema,
  operationPathProfileSchema,
  partInputSchema,
  pathPlanAssumptionSchema,
  pathPlanSchema,
  pathPlanWarningSchema,
  planningWarningSchema,
  samplePartInput,
  type ApprovalRequest,
  type DepthAssumption,
  type DepthWarning,
  type DraftCamPlan,
  type FeatureDepthModel,
  type FeatureClassification,
  type MachiningAssumption,
  type MachiningIntent,
  type NormalizedFeature,
  type Operation,
  type OperationDepthProfile,
  type OperationPathProfile,
  type OperationCandidate,
  type OperationKind,
  type OperationLink,
  type PathPlan,
  type PathPlanAssumption,
  type PathPlanSegment,
  type PathPlanWarning,
  type PartInput,
  type PathDirectionHint,
  type PathOrderingHint,
  type PlanningWarning,
  type Risk,
  type RiskLevel,
  type Tool,
  type ToolClass,
  type ToolSelectionReason,
} from '@cam/shared';
import {
  buildGeometryGraph,
  geometry2DDocumentSchema,
  type GeometryBounds,
  type Geometry2DDocument,
  type GeometryGraph,
} from '@cam/geometry2d';

const featureKindOrder = [
  'top_surface',
  'contour',
  'pocket',
  'slot',
  'hole_group',
  'chamfer',
  'engraving',
] as const;

const narrowMillingWidthThresholdMm = 8;
const narrowSlotWidthThresholdMm = 6;
const defaultSetupId = defaultSetups[0]?.id ?? 'setup-1';
const inferredDepthMm = 1;
const inferredStockZMm = 6;
const geometryDiameterGroupingToleranceMm = 0.15;
const deepContourThresholdMm = 8;
const polarPatternRadialToleranceMm = 0.25;
const multiHoleGroupConfidence = 0.97;
const singleHoleGroupConfidence = 0.88;
const minimumRegionAreaDivisor = 1;
const slotElongationRatio = 4;
const slotWidthToleranceFactor = 1.5;
const pocketAreaRatioThreshold = 0.02;

type ToolSelection = {
  tool: Tool;
  toolClass: ToolClass;
  reason: ToolSelectionReason;
};

type FeatureDepthSignals = {
  assumptions: DepthAssumption[];
  warnings: DepthWarning[];
  depthStatus: 'known' | 'assumed' | 'unknown';
  unknownDepthReason?: 'dxf_2d_only' | 'manual_review_required' | 'hole_callout_missing';
  bottomBehavior: 'floor' | 'through' | 'blind' | 'unknown';
};

type RegenerationOptions = {
  selectedFeatureIds?: string[];
  preserveFrozenEdited?: boolean;
};

function roundNumber(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function warningCode(label: string): string {
  return sanitizeId(label).replace(/-/g, '_');
}

export type GeometryFeatureInferenceKind =
  | 'outside_contour'
  | 'inside_contour'
  | 'pocket'
  | 'hole_group'
  | 'slot'
  | 'engraving'
  | 'unclassified';

export type GeometryFeatureInference = {
  id: string;
  label: string;
  kind: GeometryFeatureInferenceKind;
  mappedFeatureKind?: Extract<NormalizedFeature['kind'], 'contour' | 'pocket' | 'slot' | 'hole_group' | 'engraving'>;
  plannedFeatureId?: string;
  sourceGeometryRefs: string[];
  confidence: number;
  inferenceMethod: string;
  warnings: string[];
  bounds: GeometryBounds;
};

export type GeometryFeatureExtractionResult = {
  graph: GeometryGraph;
  features: GeometryFeatureInference[];
  unclassifiedEntityIds: string[];
  warnings: string[];
  partInput: PartInput;
};

function highestRisk(risks: Risk[]): RiskLevel {
  if (risks.some((risk) => risk.level === 'high')) {
    return 'high';
  }

  if (risks.some((risk) => risk.level === 'medium')) {
    return 'medium';
  }

  return 'low';
}

function createFeatureId(kind: string, index: number, sourceId?: string): string {
  return sourceId ?? `${kind}-${index + 1}`;
}

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function copyFeatureMetadata(
  source: Pick<
    PartInput['contours'][number],
    'sourceGeometryRefs' | 'inferenceMethod' | 'confidence' | 'warnings' | 'origin' | 'classificationState'
  >,
) {
  return {
    sourceGeometryRefs: source.sourceGeometryRefs,
    ...(source.inferenceMethod ? { inferenceMethod: source.inferenceMethod } : {}),
    confidence: source.confidence,
    warnings: source.warnings,
    origin: source.origin,
    classificationState: source.classificationState,
  };
}

function inferFeatureClassification(feature: Pick<NormalizedFeature, 'kind' | 'name' | 'origin' | 'classificationState' | 'inferenceMethod'>): FeatureClassification {
  if (feature.classificationState === 'ignored') {
    return 'ignored';
  }

  switch (feature.kind) {
    case 'contour': {
      const descriptor = `${feature.name} ${feature.inferenceMethod ?? ''}`.toLowerCase();
      if (descriptor.includes('inside') || descriptor.includes('internal')) {
        return 'inside_contour';
      }
      if (descriptor.includes('outside') || descriptor.includes('outer')) {
        return 'outside_contour';
      }
      return feature.origin === 'geometry_inferred' ? 'inside_contour' : 'outside_contour';
    }
    case 'pocket':
      return 'pocket';
    case 'slot':
      return 'slot';
    case 'hole_group':
      return 'hole_group';
    case 'engraving':
      return 'engraving';
    default:
      return 'unclassified';
  }
}

function buildMachiningIntent(feature: Pick<
  NormalizedFeature,
  'id' | 'kind' | 'name' | 'origin' | 'classificationState' | 'inferenceMethod' | 'confidence' | 'warnings'
>): MachiningIntent {
  const classification = inferFeatureClassification(feature);
  return machiningIntentSchema.parse({
    featureId: feature.id,
    classification,
    confidence: feature.confidence,
    requiresReview:
      classification === 'unclassified'
      || classification === 'ignored'
      || feature.classificationState !== 'automatic'
      || (feature.origin === 'geometry_inferred' && (feature.confidence < 0.9 || feature.warnings.length > 0)),
    rationale:
      feature.inferenceMethod
      ?? (feature.classificationState === 'manual_override'
        ? `Manual override retained ${classification.replaceAll('_', ' ')} intent.`
        : `Structured ${feature.kind.replaceAll('_', ' ')} intent preserved.`),
    source:
      feature.classificationState === 'manual_override'
        ? 'manual_override'
        : feature.origin === 'geometry_inferred'
          ? 'extracted_feature'
          : 'structured',
  });
}

const defaultSetupPlane = {
  id: 'setup-plane-top',
  label: 'Top setup plane',
  orientation: 'top' as const,
};

const defaultSetupReference = {
  setupPlane: defaultSetupPlane,
  workOffset: {
    id: 'work-offset-g54',
    label: 'Primary work offset',
    code: 'G54',
  },
};

function buildFeatureDepthSignals(feature: Pick<NormalizedFeature, 'id' | 'name' | 'kind' | 'origin' | 'depthMm' | 'warnings'>): FeatureDepthSignals {
  if (feature.depthMm <= 0) {
    return {
      assumptions: [],
      warnings: [],
      depthStatus: feature.kind === 'top_surface' ? 'known' : 'unknown',
      ...(feature.kind === 'top_surface' ? {} : { unknownDepthReason: 'manual_review_required' as const }),
      bottomBehavior: 'unknown',
    };
  }

  if (feature.origin !== 'geometry_inferred') {
    return {
      assumptions: [],
      warnings: [],
      depthStatus: 'known',
      bottomBehavior:
        feature.kind === 'contour'
          ? 'blind'
          : feature.kind === 'hole_group'
            ? 'blind'
            : 'floor',
    };
  }

  const assumptions: DepthAssumption[] = [
    depthAssumptionSchema.parse({
      id: `${feature.id}-depth-assumed`,
      label: 'Depth assumed from 2D source',
      description: `${feature.name} uses a provisional ${roundNumber(feature.depthMm)} mm depth because imported 2D geometry does not include verified Z extents.`,
      source: 'import_default',
      reviewRequired: true,
    }),
  ];
  const warnings: DepthWarning[] = [
    depthWarningSchema.parse({
      code: 'depth_assumed_from_2d',
      message: 'Depth is inferred from a 2D planning default and must be confirmed before release.',
      severity: feature.warnings.length > 0 ? 'high' : 'medium',
      reviewRequired: true,
    }),
  ];

  let bottomBehavior: 'floor' | 'through' | 'blind' | 'unknown' = 'unknown';
  if (feature.kind === 'contour') {
    bottomBehavior = 'through';
    assumptions.push(depthAssumptionSchema.parse({
      id: `${feature.id}-through-cut-assumed`,
      label: 'Through-cut assumed',
      description: '2D contour geometry does not prove stock break-through, so the planner keeps this as a review-required through-cut assumption.',
      source: 'import_default',
      reviewRequired: true,
    }));
  } else if (feature.kind === 'pocket' || feature.kind === 'slot') {
    bottomBehavior = 'floor';
  } else if (feature.kind === 'hole_group') {
    bottomBehavior = 'unknown';
    warnings.push(depthWarningSchema.parse({
      code: 'hole_depth_callout_missing',
      message: 'Hole depth is not verified by the 2D source. Through/blind intent must be confirmed manually.',
      severity: 'high',
      reviewRequired: true,
    }));
  } else if (feature.kind === 'chamfer' || feature.kind === 'engraving') {
    bottomBehavior = 'blind';
  }

  return {
    assumptions,
    warnings,
    depthStatus: 'assumed',
    unknownDepthReason: feature.kind === 'hole_group' ? 'hole_callout_missing' : 'dxf_2d_only',
    bottomBehavior,
  };
}

function fieldSource(feature: Pick<NormalizedFeature, 'origin'>): 'generated' | 'assumed' {
  return feature.origin === 'geometry_inferred' ? 'assumed' : 'generated';
}

function buildFeatureDepthModel(
  feature: Pick<NormalizedFeature, 'id' | 'name' | 'kind' | 'depthMm' | 'origin' | 'warnings'>,
  stockZMm = inferredStockZMm,
): FeatureDepthModel {
  const stockTopReference = {
    id: `${feature.id}-stock-top`,
    kind: 'stock_top' as const,
    label: 'Stock top',
    zMm: 0,
  };
  const stockBottomReference = {
    id: `${feature.id}-stock-bottom`,
    kind: 'unknown' as const,
    label: 'Stock bottom',
    zMm: -stockZMm,
  };
  const floorReference = {
    id: `${feature.id}-feature-floor`,
    kind: feature.depthMm > 0 ? 'feature_floor' as const : 'feature_top' as const,
    label: feature.depthMm > 0 ? `${feature.name} floor` : `${feature.name} top`,
    zMm: -feature.depthMm,
  };
  const signals = buildFeatureDepthSignals(feature);
  const machiningLevels = [
    {
      id: `${feature.id}-level-stock-top`,
      label: 'Stock top',
      reference: stockTopReference,
      zMm: 0,
    },
    ...(feature.depthMm > 0
      ? [{
          id: `${feature.id}-level-floor`,
          label: 'Target floor',
          reference: floorReference,
          zMm: floorReference.zMm,
        }]
      : []),
  ];

  return featureDepthModelSchema.parse({
    setupPlane: defaultSetupPlane,
    setupReference: defaultSetupReference,
    stockTop: {
      reference: stockTopReference,
      zMm: stockTopReference.zMm,
    },
    stockBottom: {
      reference: stockBottomReference,
      zMm: stockBottomReference.zMm,
    },
    topReference: {
      reference: stockTopReference,
      source: signals.depthStatus === 'known' ? 'known' : signals.depthStatus,
    },
    ...(feature.depthMm > 0
      ? {
          bottomReference: {
            reference: floorReference,
            source: signals.depthStatus === 'known' ? 'known' : signals.depthStatus,
            behavior: signals.bottomBehavior,
          },
          floorLevel: {
            reference: floorReference,
            zMm: floorReference.zMm,
          },
          depthRange: {
            topZMm: 0,
            bottomZMm: floorReference.zMm,
          },
        }
      : {}),
    depthStatus: signals.depthStatus,
    ...(signals.unknownDepthReason ? { unknownDepthReason: signals.unknownDepthReason } : {}),
    machiningLevels,
    assumptions: signals.assumptions,
    warnings: signals.warnings,
  });
}

function buildPassDepthPlan(
  feature: NormalizedFeature,
  tool: Tool,
  operationKind: OperationKind,
  operationName: string,
): OperationDepthProfile['passDepthPlan'] {
  if (feature.depthMm <= 0) {
    return undefined;
  }

  const conservativeStepDownMm = operationKind === 'drill'
    ? roundNumber(Math.min(feature.depthMm, Math.max(Math.min(tool.maxDepthMm / 2, tool.diameterMm * 2.5), 0.5)))
    : roundNumber(Math.min(feature.depthMm, Math.max(Math.min(tool.diameterMm * 0.75, tool.maxDepthMm / 3), 0.25)));
  const roughingLayerCount = Math.max(1, Math.ceil(feature.depthMm / conservativeStepDownMm));
  const finishPass = operationKind === 'pocket'
    ? operationName.toLowerCase().includes('finish')
      ? 'wall_and_floor'
      : 'none'
    : operationKind === 'profile'
      ? operationName.toLowerCase().includes('finish')
        ? 'profile_cleanup'
        : 'none'
      : operationKind === 'chamfer'
        ? 'wall'
        : operationKind === 'engrave'
          ? 'floor'
          : 'none';

  return {
    roughingLayerCount,
    maxStepDownMm: conservativeStepDownMm,
    finishPass,
    retractTo: roughingLayerCount > 1 ? 'retract_plane' : 'safe_clearance',
    note:
      roughingLayerCount > 1
        ? `${roughingLayerCount} planning layers derived from conservative step-down assumptions. This is not a final NC pass calculation.`
        : 'Single planning depth layer only. This remains a depth-aware machining preview hint, not a final NC pass list.',
  } as const;
}

function buildOperationDepthProfile(feature: NormalizedFeature, tool: Tool, candidate: OperationCandidate): OperationDepthProfile {
  const depthModel = feature.depthModel ?? buildFeatureDepthModel(feature);
  const autoFieldSource = fieldSource(feature);
  const passDepthHintMm = feature.depthMm > 0
    ? roundNumber(Math.min(feature.depthMm, Math.max(Math.min(tool.maxDepthMm / 2, tool.maxDepthMm), 0.25)))
    : undefined;
  const passDepthPlan = buildPassDepthPlan(feature, tool, candidate.kind, candidate.name);
  const warnings = [...depthModel.warnings];

  if (feature.depthMm > tool.maxDepthMm) {
    warnings.push(depthWarningSchema.parse({
      code: 'tool_depth_review_required',
      message: `${tool.name} max depth (${roundNumber(tool.maxDepthMm)} mm) is shallower than the requested ${roundNumber(feature.depthMm)} mm feature depth.`,
      severity: 'high',
      reviewRequired: true,
    }));
  }

  return operationDepthProfileSchema.parse({
    setupPlane: depthModel.setupPlane,
    setupReference: depthModel.setupReference,
    stockTop: depthModel.stockTop,
    stockBottom: depthModel.stockBottom,
    topReference: depthModel.topReference,
    bottomReference: depthModel.bottomReference,
    floorLevel: depthModel.floorLevel,
    depthRange: depthModel.depthRange,
    ...(feature.depthMm > 0 ? { targetDepthMm: feature.depthMm } : {}),
    depthStatus: depthModel.depthStatus,
    ...(depthModel.unknownDepthReason ? { unknownDepthReason: depthModel.unknownDepthReason } : {}),
    ...(passDepthHintMm
      ? {
          passDepthHint: {
            axialStepDownMm: passDepthHintMm,
            basis: feature.depthMm > tool.maxDepthMm ? 'tool_capacity' : 'feature_depth',
          },
        }
      : {}),
    ...(passDepthPlan ? { passDepthPlan } : {}),
    safeClearance: {
      reference: {
        id: `${feature.id}-safe-clearance`,
        kind: 'safe_clearance',
        label: 'Safe clearance',
        zMm: 5,
      },
      zMm: 5,
    },
    retractPlane: {
      reference: {
        id: `${feature.id}-retract-plane`,
        kind: 'safe_clearance',
        label: 'Retract plane',
        zMm: 8,
      },
      zMm: 8,
    },
    fieldSources: {
      ...(feature.depthMm > 0 ? { targetDepth: autoFieldSource, floorLevel: autoFieldSource, bottomBehavior: autoFieldSource } : {}),
      topReference: 'generated',
      safeClearance: 'generated',
      retractPlane: 'generated',
      ...(passDepthPlan ? { passDepthPlan: autoFieldSource } : {}),
    },
    assumptions: depthModel.assumptions,
    warnings,
  });
}

function normalizePart(part: PartInput): NormalizedFeature[] {
  const features: NormalizedFeature[] = [];
  const stockZMm = part.stock.zMm;

  part.topSurfaces.forEach((surface, index) => {
    features.push({
      id: createFeatureId('top-surface', index, surface.id),
      sourceId: surface.id ?? `top-surface-${index + 1}`,
      name: surface.name,
      kind: 'top_surface',
      quantity: 1,
      depthMm: 0,
      lengthMm: Math.sqrt(surface.areaMm2),
      widthMm: Math.sqrt(surface.areaMm2),
      areaMm2: surface.areaMm2,
      notes: [`Finish target: ${surface.finish}`],
      ...copyFeatureMetadata(surface),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('top-surface', index, surface.id),
        name: surface.name,
        kind: 'top_surface',
        depthMm: 0,
        origin: surface.origin,
        warnings: surface.warnings,
      }, stockZMm),
    });
  });

  part.contours.forEach((contour, index) => {
    features.push({
      id: createFeatureId('contour', index, contour.id),
      sourceId: contour.id ?? `contour-${index + 1}`,
      name: contour.name,
      kind: 'contour',
      quantity: 1,
      depthMm: contour.depthMm,
      lengthMm: contour.lengthMm,
      widthMm: 0,
      areaMm2: contour.lengthMm * contour.depthMm,
      notes: ['Structured contour input normalized as a profile boundary.'],
      ...copyFeatureMetadata(contour),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('contour', index, contour.id),
        name: contour.name,
        kind: 'contour',
        depthMm: contour.depthMm,
        origin: contour.origin,
        warnings: contour.warnings,
      }, stockZMm),
    });
  });

  part.pockets.forEach((pocket, index) => {
    features.push({
      id: createFeatureId('pocket', index, pocket.id),
      sourceId: pocket.id ?? `pocket-${index + 1}`,
      name: pocket.name,
      kind: 'pocket',
      quantity: 1,
      depthMm: pocket.depthMm,
      lengthMm: pocket.lengthMm,
      widthMm: pocket.widthMm,
      areaMm2: pocket.lengthMm * pocket.widthMm,
      notes: ['Pocket kept rectangular in v2; no freeform geometry is assumed.'],
      ...copyFeatureMetadata(pocket),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('pocket', index, pocket.id),
        name: pocket.name,
        kind: 'pocket',
        depthMm: pocket.depthMm,
        origin: pocket.origin,
        warnings: pocket.warnings,
      }, stockZMm),
    });
  });

  part.slots.forEach((slot, index) => {
    features.push({
      id: createFeatureId('slot', index, slot.id),
      sourceId: slot.id ?? `slot-${index + 1}`,
      name: slot.name,
      kind: 'slot',
      quantity: 1,
      depthMm: slot.depthMm,
      lengthMm: slot.lengthMm,
      widthMm: slot.widthMm,
      areaMm2: slot.lengthMm * slot.widthMm,
      notes: ['Slot width drives tool selection and machinability risk.'],
      ...copyFeatureMetadata(slot),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('slot', index, slot.id),
        name: slot.name,
        kind: 'slot',
        depthMm: slot.depthMm,
        origin: slot.origin,
        warnings: slot.warnings,
      }, stockZMm),
    });
  });

  part.holeGroups.forEach((holeGroup, index) => {
    features.push({
      id: createFeatureId('hole-group', index, holeGroup.id),
      sourceId: holeGroup.id ?? `hole-group-${index + 1}`,
      name: holeGroup.name,
      kind: 'hole_group',
      quantity: holeGroup.count,
      depthMm: holeGroup.depthMm,
      lengthMm: holeGroup.diameterMm,
      widthMm: holeGroup.diameterMm,
      areaMm2: Math.PI * (holeGroup.diameterMm / 2) ** 2 * holeGroup.count,
      notes: [`Pattern: ${holeGroup.pattern}`],
      ...copyFeatureMetadata(holeGroup),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('hole-group', index, holeGroup.id),
        name: holeGroup.name,
        kind: 'hole_group',
        depthMm: holeGroup.depthMm,
        origin: holeGroup.origin,
        warnings: holeGroup.warnings,
      }, stockZMm),
    });
  });

  part.chamfers.forEach((chamfer, index) => {
    features.push({
      id: createFeatureId('chamfer', index, chamfer.id),
      sourceId: chamfer.id ?? `chamfer-${index + 1}`,
      name: chamfer.name,
      kind: 'chamfer',
      quantity: 1,
      depthMm: chamfer.sizeMm,
      lengthMm: chamfer.lengthMm,
      widthMm: chamfer.sizeMm,
      areaMm2: chamfer.lengthMm * chamfer.sizeMm,
      notes: ['Chamfer modeled as an edge break request only.'],
      ...copyFeatureMetadata(chamfer),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('chamfer', index, chamfer.id),
        name: chamfer.name,
        kind: 'chamfer',
        depthMm: chamfer.sizeMm,
        origin: chamfer.origin,
        warnings: chamfer.warnings,
      }, stockZMm),
    });
  });

  part.engraving.forEach((engraving, index) => {
    features.push({
      id: createFeatureId('engraving', index, engraving.id),
      sourceId: engraving.id ?? `engraving-${index + 1}`,
      name: engraving.name,
      kind: 'engraving',
      quantity: 1,
      depthMm: engraving.depthMm,
      lengthMm: engraving.lengthMm,
      widthMm: 0.2,
      areaMm2: engraving.lengthMm * 0.2,
      notes: [`Text: ${engraving.text}`],
      ...copyFeatureMetadata(engraving),
      depthModel: buildFeatureDepthModel({
        id: createFeatureId('engraving', index, engraving.id),
        name: engraving.name,
        kind: 'engraving',
        depthMm: engraving.depthMm,
        origin: engraving.origin,
        warnings: engraving.warnings,
      }, stockZMm),
    });
  });

  return features
    .sort((left, right) => featureKindOrder.indexOf(left.kind) - featureKindOrder.indexOf(right.kind))
    .map((feature) => ({
      ...feature,
      machiningIntent: buildMachiningIntent(feature),
    }));
}

function requireTool(toolId: string): Tool {
  const tool = defaultToolLibrary.tools.find((candidate) => candidate.id === toolId);
  if (!tool) {
    throw new Error(`Required tool ${toolId} is missing from the default tool library.`);
  }

  return tool;
}

function selectionReason(
  toolClass: ToolClass,
  reason: string,
  ruleId: string,
  diameterBasisMm?: number,
  depthBasisMm?: number,
  warnings: string[] = [],
  weakMatch = false,
) {
  return {
    toolClass,
    reason,
    ruleId,
    ...(typeof diameterBasisMm === 'number' ? { diameterBasisMm } : {}),
    ...(typeof depthBasisMm === 'number' ? { depthBasisMm } : {}),
    warnings,
    weakMatch,
  };
}

function selectTool(feature: NormalizedFeature): ToolSelection {
  const classification = feature.machiningIntent?.classification ?? inferFeatureClassification(feature);
  switch (feature.kind) {
    case 'top_surface':
      return {
        tool: requireTool('tool-face-16'),
        toolClass: 'face_mill',
        reason: selectionReason('face_mill', 'Top surface facing uses the face mill to establish a simple datum surface.', 'tool-rule-face-surface', 16),
      };
    case 'contour': {
      const tool = feature.depthMm > deepContourThresholdMm || classification === 'inside_contour' ? requireTool('tool-flat-6') : requireTool('tool-flat-10');
      const warnings = feature.origin === 'geometry_inferred'
        ? ['Contour depth and break-through intent are still assumptions from 2D source geometry.']
        : [];
      return {
        tool,
        toolClass: 'contour_end_mill',
        reason: selectionReason(
          'contour_end_mill',
          classification === 'inside_contour'
            ? 'Inside contour intent prefers the smaller contour tool for tighter internal wall access.'
            : 'Outside contour intent prefers the larger contour tool for stable wall cleanup and better reach margin.',
          classification === 'inside_contour' ? 'tool-rule-inside-contour' : 'tool-rule-outside-contour',
          tool.diameterMm,
          feature.depthMm,
          warnings,
          warnings.length > 0,
        ),
      };
    }
    case 'pocket': {
      const tool = feature.widthMm > 0 && feature.widthMm <= narrowMillingWidthThresholdMm
        ? requireTool('tool-flat-6')
        : requireTool('tool-flat-10');
      const warnings = feature.widthMm <= tool.diameterMm
        ? ['Pocket width is close to the selected tool diameter. Confirm radial engagement and cleanup reach.']
        : [];
      return {
        tool,
        toolClass: 'pocket_end_mill',
        reason: selectionReason(
          'pocket_end_mill',
          'Pocket width drives the first-pass end mill choice for conservative roughing and cleanup.',
          feature.widthMm <= narrowMillingWidthThresholdMm ? 'tool-rule-pocket-narrow' : 'tool-rule-pocket-standard',
          tool.diameterMm,
          feature.depthMm,
          warnings,
          warnings.length > 0,
        ),
      };
    }
    case 'slot': {
      const narrowSlot = feature.widthMm <= 4;
      const tool = narrowSlot ? requireTool('tool-slot-3') : feature.widthMm <= narrowSlotWidthThresholdMm ? requireTool('tool-flat-6') : requireTool('tool-flat-10');
      const toolClass = narrowSlot ? 'small_slot_end_mill' : 'pocket_end_mill';
      const warnings = feature.depthMm > tool.maxDepthMm
        ? ['Selected slot tool does not fully cover the requested slot depth and needs programmer review.']
        : feature.widthMm <= tool.diameterMm
          ? ['Slot width matches the selected tool diameter closely, so the rule is conservative and may need override.']
          : [];
      return {
        tool,
        toolClass,
        reason: selectionReason(
          toolClass,
          narrowSlot
            ? 'Very narrow slot candidates prefer the small slot end mill class before wider general-purpose end mills.'
            : 'Slot width drives centerline slotting tool class selection.',
          narrowSlot ? 'tool-rule-slot-narrow' : 'tool-rule-slot-standard',
          tool.diameterMm,
          feature.depthMm,
          warnings,
          warnings.length > 0,
        ),
      };
    }
    case 'hole_group': {
      const tool = feature.lengthMm <= 3.5 ? requireTool('tool-drill-3') : requireTool('tool-drill-6');
      return {
        tool,
        toolClass: 'drill',
        reason: selectionReason(
          'drill',
          'Hole group diameter selects the first conservative drill size bucket.',
          'tool-rule-hole-diameter',
          feature.lengthMm,
          feature.depthMm,
          feature.origin === 'geometry_inferred' ? ['Hole through/blind intent remains unverified from the 2D source.'] : [],
          feature.origin === 'geometry_inferred',
        ),
      };
    }
    case 'chamfer':
      return {
        tool: requireTool('tool-chamfer-12'),
        toolClass: 'chamfer_tool',
        reason: selectionReason('chamfer_tool', 'Chamfer requests map to the default chamfer tool class.', 'tool-rule-chamfer', 12),
      };
    case 'engraving':
      return {
        tool: requireTool('tool-engrave-02'),
        toolClass: 'engraving_tool',
        reason: selectionReason('engraving_tool', 'Marking-only engraving remains on the dedicated engraving tool class.', 'tool-rule-engraving', 0.2, feature.depthMm),
      };
  }
}

function operationMinutes(baseMinutes: number): number {
  return Math.max(Number(baseMinutes.toFixed(1)), 0.5);
}

function sumEnabledMinutes(operations: Operation[]): number {
  return Number(
    operations
      .filter((operation) => operation.enabled)
      .reduce((sum, operation) => sum + operation.estimatedMinutes, 0)
      .toFixed(1),
  );
}

function featureRisks(feature: NormalizedFeature, part: PartInput): Risk[] {
  const risks: Risk[] = [];

  if (feature.kind === 'pocket' && feature.depthMm >= 12) {
    risks.push({
      id: `${feature.id}-risk-depth`,
      level: 'high',
      title: 'Deep pocket needs reach review',
      description: 'Pocket depth is at or above 12 mm, so tool reach and chip evacuation should be reviewed manually.',
      featureId: feature.id,
    });
  }

  if (feature.kind === 'slot' && feature.widthMm < narrowSlotWidthThresholdMm) {
    risks.push({
      id: `${feature.id}-risk-width`,
      level: 'medium',
      title: 'Narrow slot limits tooling',
      description: 'Slot width is below 6 mm, increasing deflection risk and reducing roughing options.',
      featureId: feature.id,
    });
  }

  if (feature.kind === 'hole_group' && feature.depthMm / feature.lengthMm > 3) {
    risks.push({
      id: `${feature.id}-risk-drill`,
      level: 'medium',
      title: 'Deep drilling cycle required',
      description: 'Hole depth exceeds three times diameter; pecking or coolant strategy should be confirmed.',
      featureId: feature.id,
    });
  }

  if (feature.kind === 'engraving' && feature.depthMm > 0.4) {
    risks.push({
      id: `${feature.id}-risk-engrave`,
      level: 'medium',
      title: 'Engraving depth is aggressive',
      description: 'Requested engraving depth is deeper than typical marking depth.',
      featureId: feature.id,
    });
  }

  if (part.stock.zMm > 30 && feature.depthMm > 10) {
    risks.push({
      id: `${feature.id}-risk-workholding`,
      level: 'medium',
      title: 'Tall stock with deep feature',
      description: 'Combination of tall stock and deep cutting increases workholding sensitivity.',
      featureId: feature.id,
    });
  }

  if (feature.origin === 'geometry_inferred' && feature.confidence < 0.85) {
    risks.push({
      id: `${feature.id}-risk-inference`,
      level: feature.confidence < 0.65 ? 'high' : 'medium',
      title: 'DXF-derived feature needs classification review',
      description:
        'Feature came from inferred 2D geometry with limited confidence. Confirm classification, depth, and machining intent before release.',
      featureId: feature.id,
    });
  }

  return risks;
}

function featurePlanningWarnings(feature: NormalizedFeature): PlanningWarning[] {
  const warnings = feature.warnings.map((warning) =>
    planningWarningSchema.parse({
      code: warningCode(warning),
      message: warning,
      severity:
        feature.origin === 'geometry_inferred' && feature.confidence < 0.7
          ? 'high'
          : feature.classificationState !== 'automatic'
            ? 'medium'
            : 'low',
      reviewRequired: true,
    }),
  );

  const classification = feature.machiningIntent?.classification ?? inferFeatureClassification(feature);
  if (classification === 'inside_contour' && feature.origin === 'geometry_inferred') {
    warnings.push(
      planningWarningSchema.parse({
        code: 'inside_contour_requires_review',
        message:
          'Internal closed profile was kept as an inside contour candidate. Confirm whether it should remain a contour or be promoted to a pocket before release.',
        severity: feature.confidence < 0.75 ? 'high' : 'medium',
        reviewRequired: true,
      }),
    );
  }
  if (classification === 'hole_group' && feature.quantity === 1) {
    warnings.push(
      planningWarningSchema.parse({
        code: 'single_circle_hole_review',
        message:
          'Single-circle geometry was treated as a hole candidate. Confirm that it is a drilled feature rather than reference geometry or an unfinished contour.',
        severity: 'medium',
        reviewRequired: true,
      }),
    );
  }

  return warnings;
}

function featureAssumptions(feature: NormalizedFeature): MachiningAssumption[] {
  const assumptions: MachiningAssumption[] = [];
  if (feature.origin === 'geometry_inferred') {
    assumptions.push(
      machiningAssumptionSchema.parse({
        id: `${feature.id}-assumed-depth`,
        label: 'Depth assumed from 2D import',
        description: '2D source geometry does not contain verified machining depth, so the default depth must be reviewed by a programmer.',
        reviewRequired: true,
      }),
    );
  }
  assumptions.push(
    machiningAssumptionSchema.parse({
      id: `${feature.id}-preview-only`,
      label: 'Operation preview only',
      description: 'Any preview derived from this operation is a machining preview, not a verified NC toolpath or production tool motion.',
      reviewRequired: false,
    }),
  );
  return assumptions;
}

function geometryPartId(document: Geometry2DDocument): string {
  return `dxf-${document.id.replace(/^geometry-/, '')}`;
}

function loopBoundsSize(bounds: GeometryFeatureInference['bounds']): number {
  return Math.max(bounds.size.x, bounds.size.y, 0.1);
}

function isElongated(bounds: GeometryFeatureInference['bounds']): boolean {
  const major = Math.max(bounds.size.x, bounds.size.y, 0.1);
  const minor = Math.max(Math.min(bounds.size.x, bounds.size.y), 0.1);
  return major / minor >= 3;
}

function inferHolePattern(centers: Array<{ x: number; y: number }>): PartInput['holeGroups'][number]['pattern'] {
  if (centers.length <= 1) {
    return 'custom';
  }

  const roundedXs = uniqueStrings(centers.map((center) => roundNumber(center.x, 2).toFixed(2)));
  const roundedYs = uniqueStrings(centers.map((center) => roundNumber(center.y, 2).toFixed(2)));
  if (roundedXs.length === 1 || roundedYs.length === 1) {
    return 'line';
  }
  if (centers.length === 4 && roundedXs.length === 2 && roundedYs.length === 2) {
    return 'rectangle';
  }

  const centroid = {
    x: centers.reduce((sum, center) => sum + center.x, 0) / centers.length,
    y: centers.reduce((sum, center) => sum + center.y, 0) / centers.length,
  };
  const radii = centers.map((center) => roundNumber(Math.hypot(center.x - centroid.x, center.y - centroid.y), 2));
  if (Math.max(...radii) - Math.min(...radii) <= polarPatternRadialToleranceMm) {
    return 'polar';
  }

  return 'custom';
}

function determinePreservedOperationSource(operation: Operation): Operation['source'] {
  if (operation.origin === 'manual') {
    return 'manual';
  }
  if (operation.source === 'generated') {
    return 'edited';
  }
  return operation.source;
}

function depthTopZMm(profile: OperationDepthProfile | undefined): number {
  return profile?.topReference?.reference.zMm
    ?? profile?.stockTop?.zMm
    ?? profile?.depthRange?.topZMm
    ?? 0;
}

function pathSegment(
  id: string,
  motionType: PathPlanSegment['motionType'],
  start: [number, number, number],
  end: [number, number, number],
  label?: string,
  sourceGeometryRefs: string[] = [],
): PathPlanSegment {
  return {
    id,
    kind: 'linear',
    motionType,
    points: [start, end],
    ...(label ? { label } : {}),
    sourceGeometryRefs,
  };
}

function loopSegments(
  planId: string,
  points: Array<[number, number, number]>,
  labelPrefix: string,
  sourceGeometryRefs: string[],
): PathPlanSegment[] {
  return points.slice(0, -1).map((point, index) =>
    pathSegment(
      `${planId}-feed-${index + 1}`,
      'feed_move',
      point,
      points[index + 1]!,
      `${labelPrefix} ${index + 1}`,
      sourceGeometryRefs,
    ));
}

function holePatternPoints(feature: NormalizedFeature): Array<[number, number]> {
  const pattern = feature.notes.find((note) => note.startsWith('Pattern: '))?.replace('Pattern: ', '').trim().toLowerCase() ?? 'custom';
  if (pattern === 'rectangle' && feature.quantity >= 4) {
    const rectanglePoints: Array<[number, number]> = [
      [-0.3, -0.25],
      [0.3, -0.25],
      [0.3, 0.25],
      [-0.3, 0.25],
    ];
    return rectanglePoints.slice(0, feature.quantity);
  }
  if (pattern === 'polar') {
    return Array.from({ length: Math.max(feature.quantity, 1) }, (_, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(feature.quantity, 1);
      return [roundNumber(Math.cos(angle) * 0.32, 3), roundNumber(Math.sin(angle) * 0.32, 3)] as [number, number];
    });
  }
  if (pattern === 'line') {
    const count = Math.max(feature.quantity, 1);
    return Array.from({ length: count }, (_, index) => {
      const x = count === 1 ? 0 : -0.35 + (0.7 * index) / (count - 1);
      return [roundNumber(x, 3), 0] as [number, number];
    });
  }
  const count = Math.max(feature.quantity, 1);
  return Array.from({ length: count }, (_, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return [column === 0 ? -0.22 : 0.22, -0.24 + row * 0.24] as [number, number];
  });
}

function planZLevels(profile: OperationDepthProfile | undefined) {
  return {
    topZMm: depthTopZMm(profile),
    targetDepthMm: profile?.targetDepthMm,
    targetZMm: profile?.targetDepthMm !== undefined ? -roundNumber(profile.targetDepthMm) : undefined,
    clearanceZMm: profile?.safeClearance?.zMm ?? 5,
    retractZMm: profile?.retractPlane?.zMm ?? Math.max((profile?.safeClearance?.zMm ?? 5) + 2, 8),
  };
}

function buildPathProfileWarnings(feature: NormalizedFeature, operation: Pick<Operation, 'name' | 'kind' | 'depthProfile'>): PathPlanWarning[] {
  const warnings: PathPlanWarning[] = [];

  if (feature.origin === 'geometry_inferred') {
    warnings.push(pathPlanWarningSchema.parse({
      code: 'path_from_inferred_geometry',
      message: 'Path plan is derived from inferred 2D geometry only. Loop closure, exact cutter engagement, and final NC motion still require review.',
      severity: 'medium',
      reviewRequired: true,
    }));
  }

  if (operation.depthProfile?.depthStatus === 'assumed' || operation.depthProfile?.depthStatus === 'unknown') {
    warnings.push(pathPlanWarningSchema.parse({
      code: 'path_depth_review_required',
      message: 'Path depth levels include assumed or unknown values. Clearance, target depth, and bottom behavior must be confirmed before release.',
      severity: operation.depthProfile.depthStatus === 'unknown' ? 'high' : 'medium',
      reviewRequired: true,
    }));
  }

  if (feature.kind === 'contour' && feature.machiningIntent?.classification === 'inside_contour') {
    warnings.push(pathPlanWarningSchema.parse({
      code: 'inside_contour_conservative',
      message: 'Inside contour pathing stays conservative because automatic pocket promotion was not certain.',
      severity: 'medium',
      reviewRequired: true,
    }));
  }

  if (feature.kind === 'pocket' && operation.name.toLowerCase().includes('rough')) {
    warnings.push(pathPlanWarningSchema.parse({
      code: 'pocket_lane_hint_only',
      message: 'Pocket roughing uses a first-pass lane-based path candidate only. This is not engagement-aware kernel-quality pocketing.',
      severity: 'low',
      reviewRequired: true,
    }));
  }

  return warnings;
}

function buildPathProfileAssumptions(feature: NormalizedFeature, operation: Pick<Operation, 'kind' | 'depthProfile'>, tool: Tool): PathPlanAssumption[] {
  const assumptions: PathPlanAssumption[] = [];

  if (feature.kind === 'hole_group' && feature.depthMm > tool.diameterMm * 3) {
    assumptions.push(pathPlanAssumptionSchema.parse({
      id: `${feature.id}-peck-drill-hint`,
      label: 'Peck drilling may be required',
      description: 'Hole depth exceeds a simple depth-to-diameter heuristic, so this path plan flags peck drilling as a review hint instead of outputting a canned cycle.',
      reviewRequired: true,
    }));
  }

  if (operation.depthProfile?.bottomReference?.behavior === 'through') {
    assumptions.push(pathPlanAssumptionSchema.parse({
      id: `${feature.id}-through-cut-assumed`,
      label: 'Through-cut exit assumed',
      description: 'The candidate path plan preserves through-cut intent as a deterministic assumption, not a verified stock break-through simulation.',
      reviewRequired: true,
    }));
  }

  return assumptions;
}

function buildProfilePathPlans(operation: Operation, feature: NormalizedFeature, pathWarnings: PathPlanWarning[], pathAssumptions: PathPlanAssumption[]): PathPlan[] {
  const levels = planZLevels(operation.depthProfile);
  if (levels.targetZMm === undefined) {
    return [];
  }
  const targetZ = levels.targetZMm;
  const planId = `${operation.id}-path-1`;
  const roughing = operation.name.toLowerCase().includes('rough');
  const insideContour = feature.machiningIntent?.classification === 'inside_contour';
  const x = insideContour ? 0.34 : roughing ? 0.46 : 0.42;
  const y = insideContour ? 0.24 : roughing ? 0.31 : 0.28;
  const approachPoint: [number, number, number] = [-x - 0.08, -y, levels.clearanceZMm];
  const startPoint: [number, number, number] = [-x, -y, targetZ];
  const contourLoop: Array<[number, number, number]> = [
    startPoint,
    [x, -y, targetZ],
    [x, y, targetZ],
    [-x, y, targetZ],
    startPoint,
  ];
  const leadOutPoint: [number, number, number] = [-x - 0.08, -y, targetZ];
  const entryStrategy = roughing ? 'linear_ramp' : 'direct_plunge';
  const exitStrategy = 'tangent_exit';
  const entrySegment = roughing
    ? pathSegment(`${planId}-entry`, 'feed_move', approachPoint, startPoint, 'Lead-in ramp', feature.sourceGeometryRefs)
    : pathSegment(`${planId}-entry`, 'plunge_move', [-x, -y, levels.clearanceZMm], startPoint, 'Plunge entry', feature.sourceGeometryRefs);
  const segments: PathPlanSegment[] = [
    pathSegment(`${planId}-rapid`, 'rapid_move', [-x - 0.14, -y - 0.05, levels.clearanceZMm], approachPoint, 'Rapid approach', feature.sourceGeometryRefs),
    entrySegment,
    ...loopSegments(planId, contourLoop, roughing ? 'Rough contour feed' : 'Finish contour feed', feature.sourceGeometryRefs),
    pathSegment(`${planId}-lead-out`, 'feed_move', startPoint, leadOutPoint, 'Lead-out', feature.sourceGeometryRefs),
    pathSegment(`${planId}-retract`, 'retract_move', leadOutPoint, [-x - 0.08, -y, levels.retractZMm], 'Retract', feature.sourceGeometryRefs),
  ];

  return [
    pathPlanSchema.parse({
      id: planId,
      operationId: operation.id,
      featureId: operation.featureId,
      label: roughing ? 'Contour roughing candidate' : 'Contour finishing candidate',
      intent: roughing ? 'roughing' : 'finishing',
      coordinateReference: 'feature_normalized',
      sourceGeometryRefs: feature.sourceGeometryRefs,
      entryStrategy,
      exitStrategy,
      clearanceStrategy: 'safe_clearance',
      retractStrategy: operation.depthProfile?.passDepthPlan?.retractTo === 'retract_plane' ? 'retract_plane' : 'safe_clearance',
      pathDirectionHint: insideContour ? 'ccw' : 'climb',
      orderingHint: {
        mode: 'loop_priority',
        direction: insideContour ? 'ccw' : 'climb',
        note: insideContour ? 'Single internal contour candidate kept conservative.' : 'Outside contour stays late in the sequence to preserve part stability.',
      },
      leadIn: {
        strategy: entryStrategy,
        segmentIds: [entrySegment.id],
      },
      leadOut: {
        strategy: exitStrategy,
        segmentIds: [`${planId}-lead-out`],
      },
      topReferenceZMm: levels.topZMm,
      targetDepthMm: levels.targetDepthMm,
      clearanceZMm: levels.clearanceZMm,
      retractZMm: levels.retractZMm,
      passDepthPlan: operation.depthProfile?.passDepthPlan,
      segments,
      warnings: pathWarnings,
      assumptions: pathAssumptions,
    }),
  ];
}

function buildPocketPathPlans(operation: Operation, feature: NormalizedFeature, pathWarnings: PathPlanWarning[], pathAssumptions: PathPlanAssumption[]): PathPlan[] {
  const levels = planZLevels(operation.depthProfile);
  if (levels.targetZMm === undefined) {
    return [];
  }
  const targetZ = levels.targetZMm;
  const planId = `${operation.id}-path-1`;
  const roughing = operation.name.toLowerCase().includes('rough');
  const laneXs = [-0.35, -0.12, 0.12, 0.35];
  const segments: PathPlanSegment[] = [
    pathSegment(`${planId}-rapid`, 'rapid_move', [-0.42, -0.3, levels.clearanceZMm], [laneXs[0]!, -0.3, levels.clearanceZMm], 'Rapid to pocket start', feature.sourceGeometryRefs),
    pathSegment(`${planId}-entry`, 'plunge_move', [laneXs[0]!, -0.3, levels.clearanceZMm], [laneXs[0]!, -0.3, targetZ], roughing ? 'Pocket plunge' : 'Finish plunge', feature.sourceGeometryRefs),
  ];

  if (roughing) {
    laneXs.forEach((laneX, index) => {
      const startY = index % 2 === 0 ? -0.3 : 0.3;
      const endY = index % 2 === 0 ? 0.3 : -0.3;
      segments.push(pathSegment(`${planId}-lane-${index + 1}`, 'feed_move', [laneX, startY, targetZ], [laneX, endY, targetZ], `Pocket lane ${index + 1}`, feature.sourceGeometryRefs));
      if (laneXs[index + 1] !== undefined) {
        segments.push(pathSegment(`${planId}-link-${index + 1}`, 'feed_move', [laneX, endY, targetZ], [laneXs[index + 1]!, endY, targetZ], `Lane link ${index + 1}`, feature.sourceGeometryRefs));
      }
    });
  } else {
    const finishLoop: Array<[number, number, number]> = [
      [-0.4, -0.3, targetZ],
      [0.4, -0.3, targetZ],
      [0.4, 0.3, targetZ],
      [-0.4, 0.3, targetZ],
      [-0.4, -0.3, targetZ],
    ];
    segments.push(...loopSegments(planId, finishLoop, 'Pocket finish feed', feature.sourceGeometryRefs));
  }

  const finalPoint = segments.at(-1)?.points[1] ?? [0.35, 0.3, targetZ] as [number, number, number];
  segments.push(pathSegment(`${planId}-retract`, 'retract_move', finalPoint, [finalPoint[0], finalPoint[1], levels.retractZMm], 'Pocket retract', feature.sourceGeometryRefs));

  return [
    pathPlanSchema.parse({
      id: planId,
      operationId: operation.id,
      featureId: operation.featureId,
      label: roughing ? 'Pocket roughing candidate' : 'Pocket finish candidate',
      intent: roughing ? 'roughing' : 'finishing',
      coordinateReference: 'feature_normalized',
      sourceGeometryRefs: feature.sourceGeometryRefs,
      entryStrategy: 'direct_plunge',
      exitStrategy: 'direct_retract',
      clearanceStrategy: 'safe_clearance',
      retractStrategy: operation.depthProfile?.passDepthPlan?.retractTo === 'retract_plane' ? 'retract_plane' : 'safe_clearance',
      pathDirectionHint: roughing ? 'left_to_right' : 'climb',
      orderingHint: {
        mode: roughing ? 'nearest_neighbor' : 'loop_priority',
        direction: roughing ? 'left_to_right' : 'climb',
        note: roughing ? 'First-pass lane order only.' : 'Single finish boundary candidate.',
      },
      leadIn: {
        strategy: 'direct_plunge',
        segmentIds: [`${planId}-entry`],
      },
      leadOut: {
        strategy: 'direct_retract',
        segmentIds: [`${planId}-retract`],
      },
      topReferenceZMm: levels.topZMm,
      targetDepthMm: levels.targetDepthMm,
      clearanceZMm: levels.clearanceZMm,
      retractZMm: levels.retractZMm,
      passDepthPlan: operation.depthProfile?.passDepthPlan,
      segments,
      warnings: pathWarnings,
      assumptions: pathAssumptions,
    }),
  ];
}

function buildSlotPathPlans(operation: Operation, feature: NormalizedFeature, pathWarnings: PathPlanWarning[], pathAssumptions: PathPlanAssumption[]): PathPlan[] {
  const levels = planZLevels(operation.depthProfile);
  if (levels.targetZMm === undefined) {
    return [];
  }
  const targetZ = levels.targetZMm;
  const planId = `${operation.id}-path-1`;
  const start: [number, number, number] = [-0.45, 0, targetZ];
  const end: [number, number, number] = [0.45, 0, targetZ];
  const segments: PathPlanSegment[] = [
    pathSegment(`${planId}-rapid`, 'rapid_move', [-0.5, 0, levels.clearanceZMm], [-0.45, 0, levels.clearanceZMm], 'Rapid to slot start', feature.sourceGeometryRefs),
    pathSegment(`${planId}-entry`, 'plunge_move', [-0.45, 0, levels.clearanceZMm], start, 'Slot plunge', feature.sourceGeometryRefs),
    pathSegment(`${planId}-centerline`, 'feed_move', start, end, 'Slot centerline feed', feature.sourceGeometryRefs),
    pathSegment(`${planId}-finish-return`, 'feed_move', end, start, 'Slot cleanup return', feature.sourceGeometryRefs),
    pathSegment(`${planId}-retract`, 'retract_move', start, [-0.45, 0, levels.retractZMm], 'Slot retract', feature.sourceGeometryRefs),
  ];

  return [
    pathPlanSchema.parse({
      id: planId,
      operationId: operation.id,
      featureId: operation.featureId,
      label: 'Slot centerline candidate',
      intent: 'slotting',
      coordinateReference: 'feature_normalized',
      sourceGeometryRefs: feature.sourceGeometryRefs,
      entryStrategy: 'direct_plunge',
      exitStrategy: 'direct_retract',
      clearanceStrategy: 'safe_clearance',
      retractStrategy: 'retract_plane',
      pathDirectionHint: 'left_to_right',
      orderingHint: {
        mode: 'feature_order',
        direction: 'left_to_right',
        note: 'Single centerline slot candidate with cleanup return only.',
      },
      leadIn: {
        strategy: 'direct_plunge',
        segmentIds: [`${planId}-entry`],
      },
      leadOut: {
        strategy: 'direct_retract',
        segmentIds: [`${planId}-retract`],
      },
      topReferenceZMm: levels.topZMm,
      targetDepthMm: levels.targetDepthMm,
      clearanceZMm: levels.clearanceZMm,
      retractZMm: levels.retractZMm,
      passDepthPlan: operation.depthProfile?.passDepthPlan,
      segments,
      warnings: pathWarnings,
      assumptions: pathAssumptions,
    }),
  ];
}

function buildDrillPathPlans(operation: Operation, feature: NormalizedFeature, pathWarnings: PathPlanWarning[], pathAssumptions: PathPlanAssumption[]): PathPlan[] {
  const levels = planZLevels(operation.depthProfile);
  if (levels.targetZMm === undefined) {
    return [];
  }
  const targetZ = levels.targetZMm;
  const planId = `${operation.id}-path-1`;
  const holePoints = holePatternPoints(feature);
  const segments: PathPlanSegment[] = [];
  holePoints.forEach(([x, y], index) => {
    segments.push(pathSegment(`${planId}-rapid-${index + 1}`, 'rapid_move', [x, y, levels.retractZMm], [x, y, levels.clearanceZMm], `Hole ${index + 1} rapid`, feature.sourceGeometryRefs));
    segments.push(pathSegment(`${planId}-drill-${index + 1}`, 'plunge_move', [x, y, levels.clearanceZMm], [x, y, targetZ], `Hole ${index + 1} drill`, feature.sourceGeometryRefs));
    segments.push(pathSegment(`${planId}-retract-${index + 1}`, 'retract_move', [x, y, targetZ], [x, y, levels.retractZMm], `Hole ${index + 1} retract`, feature.sourceGeometryRefs));
  });

  return [
    pathPlanSchema.parse({
      id: planId,
      operationId: operation.id,
      featureId: operation.featureId,
      label: 'Grouped drill candidate',
      intent: 'drilling',
      coordinateReference: 'feature_normalized',
      sourceGeometryRefs: feature.sourceGeometryRefs,
      entryStrategy: 'direct_plunge',
      exitStrategy: 'direct_retract',
      clearanceStrategy: 'safe_clearance',
      retractStrategy: 'retract_plane',
      pathDirectionHint: 'left_to_right',
      orderingHint: {
        mode: 'pattern_group',
        direction: 'left_to_right',
        note: `Hole order follows the inferred ${feature.notes.find((note) => note.startsWith('Pattern: '))?.replace('Pattern: ', '').toLowerCase() ?? 'custom'} group pattern.`,
      },
      leadIn: {
        strategy: 'direct_plunge',
        segmentIds: holePoints.map((_, index) => `${planId}-drill-${index + 1}`),
      },
      leadOut: {
        strategy: 'direct_retract',
        segmentIds: holePoints.map((_, index) => `${planId}-retract-${index + 1}`),
      },
      topReferenceZMm: levels.topZMm,
      targetDepthMm: levels.targetDepthMm,
      clearanceZMm: levels.clearanceZMm,
      retractZMm: levels.retractZMm,
      passDepthPlan: operation.depthProfile?.passDepthPlan,
      segments,
      warnings: pathWarnings,
      assumptions: pathAssumptions,
    }),
  ];
}

function buildOperationPathProfile(operation: Operation, feature: NormalizedFeature, tool: Tool): OperationPathProfile | undefined {
  if (!operation.depthProfile) {
    return undefined;
  }

  const setup = defaultSetups.find((candidate) => candidate.id === operation.setupId) ?? defaultSetups[0];
  if (!setup) {
    return undefined;
  }

  const pathWarnings = buildPathProfileWarnings(feature, operation);
  const pathAssumptions = buildPathProfileAssumptions(feature, operation, tool);
  const pathPlans = operation.kind === 'profile'
    ? buildProfilePathPlans(operation, feature, pathWarnings, pathAssumptions)
    : operation.kind === 'pocket'
      ? buildPocketPathPlans(operation, feature, pathWarnings, pathAssumptions)
      : operation.kind === 'slot'
        ? buildSlotPathPlans(operation, feature, pathWarnings, pathAssumptions)
        : operation.kind === 'drill'
          ? buildDrillPathPlans(operation, feature, pathWarnings, pathAssumptions)
          : [];

  if (pathPlans.length === 0) {
    return undefined;
  }

  return operationPathProfileSchema.parse({
    id: `${operation.id}-path-profile`,
    operationId: operation.id,
    featureId: operation.featureId,
    previewMode: 'full_path_plan',
    setupId: operation.setupId,
    workOffset: setup.workOffsetDefinition ?? {
      id: `${setup.id}-work-offset`,
      label: `Work offset ${setup.workOffset}`,
      code: setup.workOffset,
    },
    machineCoordinateReference: setup.machineCoordinateReference,
    clearanceReference: setup.clearanceReference ?? (operation.depthProfile.safeClearance
      ? {
          id: `${operation.id}-clearance-reference`,
          label: 'Operation clearance reference',
          kind: 'safe_clearance',
          zMm: operation.depthProfile.safeClearance.zMm,
        }
      : undefined),
    stockReference: setup.stockReference ?? {
      id: `${operation.id}-stock-reference`,
      label: `${operation.setup} stock reference`,
      topZMm: depthTopZMm(operation.depthProfile),
      ...(operation.depthProfile.stockBottom?.zMm !== undefined ? { bottomZMm: operation.depthProfile.stockBottom.zMm } : {}),
      material: operation.depthProfile.stockTop ? undefined : undefined,
    },
    entryStrategy: pathPlans[0]?.entryStrategy ?? 'none',
    exitStrategy: pathPlans[0]?.exitStrategy ?? 'none',
    clearanceStrategy: pathPlans[0]?.clearanceStrategy ?? 'safe_clearance',
    retractStrategy: pathPlans[0]?.retractStrategy ?? 'safe_clearance',
    pathDirectionHint: pathPlans[0]?.pathDirectionHint,
    pathOrderingHint: pathPlans[0]?.orderingHint,
    fieldSources: {
      entryStrategy: 'generated',
      exitStrategy: 'generated',
      clearanceStrategy: 'generated',
      retractStrategy: operation.depthProfile.passDepthPlan?.retractTo === 'retract_plane' ? 'assumed' : 'generated',
      ...(pathPlans[0]?.pathDirectionHint ? { pathDirectionHint: 'generated' } : {}),
      ...(pathPlans[0]?.orderingHint ? { pathOrderingHint: 'generated' } : {}),
    },
    pathPlans,
    warnings: pathWarnings,
    assumptions: pathAssumptions,
  });
}

function withManualPathOverrides(
  existingOperation: Operation | undefined,
  regeneratedOperation: Operation,
): Operation {
  if (!existingOperation?.pathProfile || !regeneratedOperation.pathProfile) {
    return regeneratedOperation;
  }

  const fieldSources = existingOperation.pathProfile.fieldSources ?? {};
  const manualFields = Object.entries(fieldSources)
    .filter((entry): entry is [keyof typeof fieldSources, 'manual_override'] => entry[1] === 'manual_override')
    .map(([field]) => field);

  if (manualFields.length === 0) {
    return regeneratedOperation;
  }

  const preservedProfile: OperationPathProfile = {
    ...regeneratedOperation.pathProfile,
    fieldSources: {
      ...regeneratedOperation.pathProfile.fieldSources,
    },
    warnings: [...regeneratedOperation.pathProfile.warnings],
    assumptions: [...regeneratedOperation.pathProfile.assumptions],
    overridePreserved: true,
  };

  if (manualFields.includes('entryStrategy')) {
    preservedProfile.entryStrategy = existingOperation.pathProfile.entryStrategy;
    preservedProfile.fieldSources.entryStrategy = 'manual_override';
  }
  if (manualFields.includes('exitStrategy')) {
    preservedProfile.exitStrategy = existingOperation.pathProfile.exitStrategy;
    preservedProfile.fieldSources.exitStrategy = 'manual_override';
  }
  if (manualFields.includes('clearanceStrategy')) {
    preservedProfile.clearanceStrategy = existingOperation.pathProfile.clearanceStrategy;
    preservedProfile.fieldSources.clearanceStrategy = 'manual_override';
  }
  if (manualFields.includes('retractStrategy')) {
    preservedProfile.retractStrategy = existingOperation.pathProfile.retractStrategy;
    preservedProfile.fieldSources.retractStrategy = 'manual_override';
  }
  if (manualFields.includes('pathDirectionHint') && existingOperation.pathProfile.pathDirectionHint) {
    preservedProfile.pathDirectionHint = existingOperation.pathProfile.pathDirectionHint;
    preservedProfile.fieldSources.pathDirectionHint = 'manual_override';
  }
  if (manualFields.includes('pathOrderingHint') && existingOperation.pathProfile.pathOrderingHint) {
    preservedProfile.pathOrderingHint = existingOperation.pathProfile.pathOrderingHint;
    preservedProfile.fieldSources.pathOrderingHint = 'manual_override';
  }

  preservedProfile.pathPlans = preservedProfile.pathPlans.map((pathPlan) => ({
    ...pathPlan,
    entryStrategy: preservedProfile.entryStrategy,
    exitStrategy: preservedProfile.exitStrategy,
    clearanceStrategy: preservedProfile.clearanceStrategy,
    retractStrategy: preservedProfile.retractStrategy,
    pathDirectionHint: preservedProfile.pathDirectionHint,
    orderingHint: preservedProfile.pathOrderingHint ?? pathPlan.orderingHint,
    topReferenceZMm: depthTopZMm(regeneratedOperation.depthProfile),
    targetDepthMm: regeneratedOperation.depthProfile?.targetDepthMm,
    clearanceZMm: regeneratedOperation.depthProfile?.safeClearance?.zMm ?? pathPlan.clearanceZMm,
    retractZMm: regeneratedOperation.depthProfile?.retractPlane?.zMm ?? pathPlan.retractZMm,
    passDepthPlan: regeneratedOperation.depthProfile?.passDepthPlan,
  }));

  preservedProfile.assumptions = uniqueStrings([
    ...preservedProfile.assumptions.map((assumption) => assumption.id),
    `${regeneratedOperation.id}-preserved-manual-path`,
  ]).map((id) => {
    if (id !== `${regeneratedOperation.id}-preserved-manual-path`) {
      return preservedProfile.assumptions.find((assumption) => assumption.id === id)!;
    }
    return pathPlanAssumptionSchema.parse({
      id,
      label: 'Manual path-planning override preserved',
      description: 'Regeneration recomputed deterministic path candidates while preserving manually edited path-planning hints for entry, exit, clearance, retract, or ordering.',
      reviewRequired: true,
    });
  });
  preservedProfile.warnings = [
    ...preservedProfile.warnings,
    pathPlanWarningSchema.parse({
      code: 'manual_path_override_preserved',
      message: 'Manual path-planning overrides were preserved during regeneration. Confirm the regenerated candidate path still matches the programmer intent.',
      severity: 'medium',
      reviewRequired: true,
    }),
  ];

  return {
    ...regeneratedOperation,
    source: 'edited',
    pathProfile: operationPathProfileSchema.parse(preservedProfile),
  };
}

function withManualDepthOverride(
  existingOperation: Operation | undefined,
  regeneratedOperation: Operation,
): Operation {
  if (!existingOperation?.depthProfile || !regeneratedOperation.depthProfile) {
    return regeneratedOperation;
  }

  const fieldSources = existingOperation.depthProfile.fieldSources ?? {};
  const manualFields = Object.entries(fieldSources)
    .filter((entry): entry is [keyof typeof fieldSources, 'manual_override'] => entry[1] === 'manual_override')
    .map(([field]) => field);

  if (manualFields.length === 0) {
    return regeneratedOperation;
  }

  const preservedProfile: OperationDepthProfile = {
    ...regeneratedOperation.depthProfile,
    fieldSources: {
      ...regeneratedOperation.depthProfile.fieldSources,
    },
    assumptions: [...regeneratedOperation.depthProfile.assumptions],
    warnings: [...regeneratedOperation.depthProfile.warnings],
    overridePreserved: true,
  };
  const conflicts: string[] = [];

  if (manualFields.includes('topReference') && existingOperation.depthProfile.topReference) {
    preservedProfile.topReference = existingOperation.depthProfile.topReference;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      topReference: 'manual_override',
    };
  }

  if (manualFields.includes('targetDepth') && existingOperation.depthProfile.targetDepthMm !== undefined) {
    if (
      regeneratedOperation.depthProfile.targetDepthMm !== undefined
      && regeneratedOperation.depthProfile.targetDepthMm !== existingOperation.depthProfile.targetDepthMm
    ) {
      conflicts.push('Manual target depth override was kept during regeneration because it differs from the regenerated deterministic depth.');
    }
    preservedProfile.targetDepthMm = existingOperation.depthProfile.targetDepthMm;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      targetDepth: 'manual_override',
    };
  }

  if (manualFields.includes('floorLevel') && existingOperation.depthProfile.floorLevel) {
    preservedProfile.floorLevel = existingOperation.depthProfile.floorLevel;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      floorLevel: 'manual_override',
    };
  } else if (preservedProfile.targetDepthMm !== undefined) {
    const topZMm = depthTopZMm(preservedProfile);
    preservedProfile.floorLevel = {
      reference: {
        id: existingOperation.depthProfile.floorLevel?.reference.id ?? `${regeneratedOperation.featureId}-manual-floor`,
        kind: 'feature_floor',
        label: existingOperation.depthProfile.floorLevel?.reference.label ?? `${regeneratedOperation.name} manual floor`,
        zMm: roundNumber(topZMm - preservedProfile.targetDepthMm),
      },
      zMm: roundNumber(topZMm - preservedProfile.targetDepthMm),
    };
  }

  if (manualFields.includes('bottomBehavior') && existingOperation.depthProfile.bottomReference) {
    preservedProfile.bottomReference = existingOperation.depthProfile.bottomReference;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      bottomBehavior: 'manual_override',
    };
  }

  if (manualFields.includes('safeClearance') && existingOperation.depthProfile.safeClearance) {
    preservedProfile.safeClearance = existingOperation.depthProfile.safeClearance;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      safeClearance: 'manual_override',
    };
  }

  if (manualFields.includes('retractPlane') && existingOperation.depthProfile.retractPlane) {
    preservedProfile.retractPlane = existingOperation.depthProfile.retractPlane;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      retractPlane: 'manual_override',
    };
  }

  if (manualFields.includes('passDepthPlan') && existingOperation.depthProfile.passDepthPlan) {
    preservedProfile.passDepthPlan = existingOperation.depthProfile.passDepthPlan;
    preservedProfile.fieldSources = {
      ...preservedProfile.fieldSources,
      passDepthPlan: 'manual_override',
    };
  }

  if (preservedProfile.targetDepthMm !== undefined) {
    const topZMm = depthTopZMm(preservedProfile);
    preservedProfile.depthRange = {
      topZMm,
      bottomZMm: roundNumber(topZMm - preservedProfile.targetDepthMm),
    };
  }

  preservedProfile.assumptions = uniqueStrings([
    ...preservedProfile.assumptions.map((assumption) => assumption.id),
    `${regeneratedOperation.id}-preserved-manual-depth`,
  ]).map((id) => {
    if (id !== `${regeneratedOperation.id}-preserved-manual-depth`) {
      return preservedProfile.assumptions.find((assumption) => assumption.id === id)!;
    }
    return depthAssumptionSchema.parse({
      id,
      label: 'Manual depth override preserved',
      description: 'Regeneration kept the programmer-edited depth fields for this operation. Review any regenerated conflicts before approval.',
      source: 'manual_override',
      reviewRequired: true,
    });
  });
  preservedProfile.warnings = [
    ...preservedProfile.warnings,
    ...conflicts.map((message, index) => depthWarningSchema.parse({
      code: `manual_depth_override_conflict_${index + 1}`,
      message,
      severity: 'medium',
      reviewRequired: true,
    })),
  ];

  return {
    ...regeneratedOperation,
    source: 'edited',
    depthProfile: operationDepthProfileSchema.parse(preservedProfile),
  };
}

export function extractGeometryFeatures(documentInput: Geometry2DDocument, graphInput?: GeometryGraph): GeometryFeatureExtractionResult {
  const document = geometry2DDocumentSchema.parse(documentInput);
  const graph = graphInput ? graphInput : buildGeometryGraph(document);
  const warnings = [...document.warnings.map((warning) => warning.message)];
  const features: GeometryFeatureInference[] = [];
  const containedLoopIds = new Set(graph.regions.flatMap((region) => region.innerLoopIds));
  const topLevelLoops = graph.loops.filter((loop) => !containedLoopIds.has(loop.id));
  const outerLoop = [...topLevelLoops].sort((left, right) => right.area - left.area)[0];
  const profileByLoopId = new Map(graph.profiles.filter((profile) => profile.loopId).map((profile) => [profile.loopId!, profile]));
  const entityById = new Map(document.entities.map((entity) => [entity.id, entity]));

  if (!outerLoop) {
    warnings.push('No closed outer profile was detected. Draft planning will remain partial and may omit contour coverage.');
  }
  if (graph.openProfileIds.length > 0) {
    warnings.push(`${graph.openProfileIds.length} open profiles remain in the imported geometry. They are preserved for review and are not promoted into deterministic contour machining.`);
  }
  if (topLevelLoops.length > 1) {
    warnings.push('Multiple top-level closed loops were detected. The largest loop is treated as the outside contour and additional top-level loops remain conservative review candidates.');
  }

  const circleLoops = graph.loops.filter((loop) => {
    const profile = profileByLoopId.get(loop.id);
    return Boolean(profile?.closed && loop.entityIds.length === 1 && entityById.get(loop.entityIds[0]!)?.type === 'circle');
  });
  const circleGroups = new Map<string, typeof circleLoops>();
  circleLoops.forEach((loop) => {
    const circleEntity = entityById.get(loop.entityIds[0]!) as Extract<Geometry2DDocument['entities'][number], { type: 'circle' }> | undefined;
    if (!circleEntity) {
      return;
    }
    const diameterKey = roundNumber(circleEntity.radius * 2, 2).toFixed(2);
    const group = circleGroups.get(diameterKey);
    if (group) {
      group.push(loop);
      return;
    }
    circleGroups.set(diameterKey, [loop]);
  });

  circleGroups.forEach((loops, diameterKey) => {
    const circleEntities = loops
      .map((loop) => entityById.get(loop.entityIds[0]!) as Extract<Geometry2DDocument['entities'][number], { type: 'circle' }> | undefined)
      .filter((entity): entity is Extract<Geometry2DDocument['entities'][number], { type: 'circle' }> => Boolean(entity));
    const centers = circleEntities.map((entity) => entity.center);
    const uniqueCenters = uniqueStrings(centers.map((center) => `${roundNumber(center.x, 3)}:${roundNumber(center.y, 3)}`));
    const groupedBounds = loops.reduce<GeometryBounds>(
      (accumulator, loop) => ({
        min: {
          x: Math.min(accumulator.min.x, loop.bounds.min.x),
          y: Math.min(accumulator.min.y, loop.bounds.min.y),
        },
        max: {
          x: Math.max(accumulator.max.x, loop.bounds.max.x),
          y: Math.max(accumulator.max.y, loop.bounds.max.y),
        },
        size: {
          x: Math.max(accumulator.max.x, loop.bounds.max.x) - Math.min(accumulator.min.x, loop.bounds.min.x),
          y: Math.max(accumulator.max.y, loop.bounds.max.y) - Math.min(accumulator.min.y, loop.bounds.min.y),
        },
        center: {
          x:
            (Math.max(accumulator.max.x, loop.bounds.max.x) + Math.min(accumulator.min.x, loop.bounds.min.x)) / 2,
          y:
            (Math.max(accumulator.max.y, loop.bounds.max.y) + Math.min(accumulator.min.y, loop.bounds.min.y)) / 2,
        },
      }),
      loops[0]!.bounds,
    );

    const confidence = loops.length > 1 ? multiHoleGroupConfidence : singleHoleGroupConfidence;
    const inferenceWarnings = [
      'Hole depth is not present in DXF. Hole depth defaults must be reviewed manually before release.',
      ...(loops.length === 1
        ? ['Single circles may represent reference geometry rather than a true drilled hole callout. Confirm intent before release.']
        : []),
      ...(uniqueCenters.length !== centers.length
        ? ['Duplicate circle centers were detected in one diameter group. Confirm that overlapping geometry is not duplicated import content.']
        : []),
    ];

    const id = `inference-hole-group-${sanitizeId(diameterKey)}-${loops.length}`;
    features.push({
      id,
      label: loops.length > 1 ? `Hole group Ø${diameterKey} (${loops.length})` : `Hole Ø${diameterKey}`,
      kind: 'hole_group',
      mappedFeatureKind: 'hole_group',
      plannedFeatureId: id,
      sourceGeometryRefs: loops.flatMap((loop) => loop.entityIds),
      confidence,
      inferenceMethod: `${loops.length} circle loop(s) grouped by diameter and preserved as a ${inferHolePattern(centers)} hole candidate pattern`,
      warnings: inferenceWarnings,
      bounds: groupedBounds,
    });
  });

  const handledLoopIds = new Set(circleLoops.map((loop) => loop.id));

  graph.regions.forEach((region) => {
    const regionOuter = graph.loops.find((loop) => loop.id === region.outerLoopId);
    if (!regionOuter || handledLoopIds.has(regionOuter.id) || !profileByLoopId.get(regionOuter.id)?.closed) {
      return;
    }

    const topLevel = outerLoop?.id === regionOuter.id;
    features.push({
      id: topLevel ? 'inference-outside-contour-1' : `inference-inside-contour-${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`,
      label: topLevel ? 'Outside contour' : `Inside contour ${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`,
      kind: topLevel ? 'outside_contour' : 'inside_contour',
      mappedFeatureKind: 'contour',
      plannedFeatureId: topLevel ? 'inference-outside-contour-1' : `inference-inside-contour-${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`,
      sourceGeometryRefs: regionOuter.entityIds,
      confidence: topLevel ? 0.94 : 0.72,
      inferenceMethod: topLevel
        ? 'Largest top-level closed loop promoted as the outside contour candidate.'
        : 'Closed loop preserved as an internal contour candidate because pocket intent was not high-confidence.',
      warnings: topLevel
        ? []
        : ['Internal contour candidates remain conservative. Confirm whether this loop should stay as a contour, become a pocket boundary, or be ignored.'],
      bounds: regionOuter.bounds,
    });
    handledLoopIds.add(regionOuter.id);

    region.innerLoopIds.forEach((innerLoopId) => {
      const innerLoop = graph.loops.find((loop) => loop.id === innerLoopId);
      if (!innerLoop || handledLoopIds.has(innerLoop.id) || !profileByLoopId.get(innerLoop.id)?.closed) {
        return;
      }

      const ratio = Math.max(innerLoop.bounds.size.x, innerLoop.bounds.size.y, 0.1)
        / Math.max(Math.min(innerLoop.bounds.size.x, innerLoop.bounds.size.y), 0.1);
      const areaRatio = Math.abs(innerLoop.area) / Math.max(Math.abs(regionOuter.area), minimumRegionAreaDivisor);
      let kind: GeometryFeatureInferenceKind = 'inside_contour';
      let mappedFeatureKind: GeometryFeatureInference['mappedFeatureKind'] = 'contour';
      let confidence = 0.68;
      let inferenceMethod = 'Internal closed loop preserved conservatively as an inside contour candidate.';
      const inferenceWarnings: string[] = [];

      if (ratio >= slotElongationRatio && Math.min(innerLoop.bounds.size.x, innerLoop.bounds.size.y) <= narrowSlotWidthThresholdMm * slotWidthToleranceFactor) {
        kind = 'slot';
        mappedFeatureKind = 'slot';
        confidence = 0.79;
        inferenceMethod = 'Elongated internal closed loop promoted as a slot candidate.';
        inferenceWarnings.push('Slot classification is heuristic. Confirm actual slot intent, width, and wall style before release.');
      } else if (areaRatio >= pocketAreaRatioThreshold && ratio < slotElongationRatio) {
        kind = 'pocket';
        mappedFeatureKind = 'pocket';
        confidence = 0.84;
        inferenceMethod = 'Internal region contained by the outside contour promoted as a conservative pocket candidate.';
        inferenceWarnings.push('Pocket depth is not encoded in DXF and defaults must be reviewed manually.');
      } else {
        inferenceWarnings.push('Internal loop remained a contour candidate because pocket/slot confidence was not sufficient for automatic promotion.');
      }

      const id = `inference-${sanitizeId(kind)}-${features.filter((feature) => feature.kind === kind).length + 1}`;
      features.push({
        id,
        label: `${kind.replace('_', ' ')} ${features.filter((feature) => feature.kind === kind).length + 1}`,
        kind,
        mappedFeatureKind,
        plannedFeatureId: id,
        sourceGeometryRefs: innerLoop.entityIds,
        confidence,
        inferenceMethod,
        warnings: inferenceWarnings,
        bounds: innerLoop.bounds,
      });
      handledLoopIds.add(innerLoop.id);
    });
  });

  graph.loops
    .filter((loop) => !handledLoopIds.has(loop.id) && profileByLoopId.get(loop.id)?.closed)
    .forEach((loop) => {
      const id = `inference-inside-contour-${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`;
      features.push({
        id,
        label: `Inside contour ${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`,
        kind: 'inside_contour',
        mappedFeatureKind: 'contour',
        plannedFeatureId: id,
        sourceGeometryRefs: loop.entityIds,
        confidence: 0.62,
        inferenceMethod: 'Closed loop was not associated with a clear outer region, so it remains an internal contour review candidate.',
        warnings: ['Loop hierarchy is ambiguous. Confirm nesting, duplicate geometry, and whether this loop should become a contour, pocket, or ignored item.'],
        bounds: loop.bounds,
      });
    });

  document.entities
    .filter((entity): entity is Extract<Geometry2DDocument['entities'][number], { type: 'text' }> => entity.type === 'text' && entity.text.trim().length > 0)
    .forEach((entity) => {
      const textLengthMm = Math.max((entity.height ?? 2) * Math.max(entity.text.length * 0.6, 1), 1);
      features.push({
        id: `inference-engraving-${features.length + 1}`,
        label: `Engraving ${features.filter((feature) => feature.kind === 'engraving').length + 1}`,
        kind: 'engraving',
        mappedFeatureKind: 'engraving',
        plannedFeatureId: `inference-engraving-${features.length + 1}`,
        sourceGeometryRefs: [entity.id],
        confidence: 0.9,
        inferenceMethod: 'TEXT/MTEXT entities promoted as marking-only engraving candidates',
      warnings: ['Text entities are treated as marking metadata only. Stroke shape and font path are not interpreted.'],
        bounds: {
          min: { x: entity.position.x, y: entity.position.y },
          max: { x: entity.position.x + textLengthMm, y: entity.position.y + (entity.height ?? 2) },
          size: { x: textLengthMm, y: entity.height ?? 2 },
          center: { x: entity.position.x + textLengthMm / 2, y: entity.position.y + (entity.height ?? 2) / 2 },
        },
      });
    });

  const classifiedGeometryIds = new Set(features.flatMap((feature) => feature.sourceGeometryRefs));
  const unclassifiedEntityIds = document.entities
    .filter((entity) => entity.type !== 'unsupported')
    .filter((entity) => !classifiedGeometryIds.has(entity.id))
    .map((entity) => entity.id);

  if (unclassifiedEntityIds.length > 0) {
    warnings.push(`${unclassifiedEntityIds.length} geometry entities remain unclassified and require manual review.`);
  }

  const geometryBounds = document.bounds.size;
  const stockMargin = document.units === 'inch' ? 0.25 : 5;
  const stockX = Math.max(geometryBounds.x + stockMargin * 2, 10);
  const stockY = Math.max(geometryBounds.y + stockMargin * 2, 10);

  const contours = features
    .filter((feature) => feature.mappedFeatureKind === 'contour')
    .map((feature) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      lengthMm: loopBoundsSize(feature.bounds),
      depthMm: inferredDepthMm,
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: uniqueStrings(feature.warnings),
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  const pockets = features
    .filter((feature) => feature.mappedFeatureKind === 'pocket')
    .map((feature) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      lengthMm: Math.max(feature.bounds.size.x, feature.bounds.size.y),
      widthMm: Math.min(feature.bounds.size.x, feature.bounds.size.y),
      depthMm: inferredDepthMm,
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: uniqueStrings(feature.warnings),
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  const slots = features
    .filter((feature) => feature.mappedFeatureKind === 'slot')
    .map((feature) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      lengthMm: Math.max(feature.bounds.size.x, feature.bounds.size.y),
      widthMm: Math.min(feature.bounds.size.x, feature.bounds.size.y),
      depthMm: inferredDepthMm,
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: uniqueStrings(feature.warnings),
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  const holeGroups = features
    .filter((feature) => feature.mappedFeatureKind === 'hole_group')
    .map((feature) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      count: Math.max(feature.sourceGeometryRefs.length, 1),
      diameterMm: roundNumber(Math.max(feature.bounds.size.x, feature.bounds.size.y), 2),
      depthMm: inferredDepthMm,
      pattern: inferHolePattern(
        feature.sourceGeometryRefs
          .map((ref) => entityById.get(ref))
          .filter((entity): entity is Extract<Geometry2DDocument['entities'][number], { type: 'circle' }> => entity?.type === 'circle')
          .map((entity) => entity.center),
      ),
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: uniqueStrings(feature.warnings),
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  const engraving = features
    .filter((feature) => feature.mappedFeatureKind === 'engraving')
    .map((feature, index) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      text: `Imported text ${index + 1}`,
      lengthMm: Math.max(feature.bounds.size.x, 1),
      depthMm: 0.2,
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: uniqueStrings(feature.warnings),
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  return {
    graph,
    features,
    unclassifiedEntityIds,
    warnings,
    partInput: partInputSchema.parse({
      partId: geometryPartId(document),
      partName: `${document.id} DXF import`,
      revision: 'dxf-v4',
      stock: {
        material: 'UNSPECIFIED_FROM_DXF',
        xMm: stockX,
        yMm: stockY,
        zMm: inferredStockZMm,
      },
      topSurfaces: [],
      contours,
      pockets,
      slots,
      holeGroups,
      chamfers: [],
      engraving,
    }),
  };
}

function createOperation(
  candidate: OperationCandidate,
  feature: NormalizedFeature,
  selection: ToolSelection,
): Operation {
  const setup = getSetupLabel(defaultSetups, defaultSetupId);
  const links: OperationLink[] = [
    {
      featureId: feature.id,
      sourceGeometryRefs: feature.sourceGeometryRefs,
    },
  ];
  const operation: Operation = {
    id: candidate.id,
    name: candidate.name,
    kind: candidate.kind,
    featureId: feature.id,
    toolId: selection.tool.id,
    toolName: selection.tool.name,
    setupId: defaultSetupId,
    setup,
    groupId: buildOperationGroupId(defaultSetupId, feature.id),
    strategy: candidate.strategy,
    notes: '',
    estimatedMinutes: candidate.estimatedMinutes,
    enabled: true,
    origin: 'automatic',
    source: 'generated',
    order: 0,
    isDirty: false,
    frozen: false,
    toolClass: candidate.toolClass,
    toolSelectionReason: selection.reason,
    machiningIntent: candidate.machiningIntent,
    depthProfile: buildOperationDepthProfile(feature, selection.tool, candidate),
    links,
    warnings: candidate.warnings,
    assumptions: candidate.assumptions,
  };
  return {
    ...operation,
    pathProfile: buildOperationPathProfile(operation, feature, selection.tool),
  };
}

function buildOperationCandidateId(feature: NormalizedFeature, suffix: string): string {
  return `op-${sanitizeId(feature.id)}-${suffix}`;
}

function buildOperationCandidates(feature: NormalizedFeature, selection: ToolSelection): OperationCandidate[] {
  const classification = feature.machiningIntent?.classification ?? inferFeatureClassification(feature);
  const warnings = [
    ...featurePlanningWarnings(feature),
    ...selection.reason.warnings.map((warning, index) => planningWarningSchema.parse({
      code: `${warningCode(selection.reason.ruleId ?? 'tool_rule')}_${index + 1}`,
      message: warning,
      severity: selection.reason.weakMatch ? 'medium' : 'low',
      reviewRequired: true,
    })),
  ];
  const assumptions = featureAssumptions(feature);
  const machiningIntent = feature.machiningIntent ?? buildMachiningIntent(feature);
  const candidates: OperationCandidate[] = [];

  const pushCandidate = (
    suffix: string,
    name: string,
    kind: OperationKind,
    estimatedMinutes: number,
    strategy: string,
  ) => {
    candidates.push(
      operationCandidateSchema.parse({
        id: buildOperationCandidateId(feature, suffix),
        featureId: feature.id,
        kind,
        name,
        strategy,
        toolClass: selection.toolClass,
        estimatedMinutes,
        warnings,
        assumptions,
        machiningIntent,
      }),
    );
  };

  switch (feature.kind) {
    case 'top_surface':
      pushCandidate('face', `Face ${feature.name}`, 'face', operationMinutes(feature.areaMm2 / 1800), 'Face stock to establish a simple top-side datum before the remaining operations.');
      break;
    case 'contour':
      if (classification === 'outside_contour') {
        pushCandidate(
          'contour-rough',
          `Rough outside contour ${feature.name}`,
          'profile',
          operationMinutes((feature.lengthMm * Math.max(feature.depthMm, 1)) / 170),
          'Conservative outside contour roughing pass leaving material for a finish cleanup pass. Depth planning stays advisory and keeps any through-cut assumptions explicit.',
        );
        pushCandidate(
          'contour-finish',
          `Finish outside contour ${feature.name}`,
          'profile',
          operationMinutes(feature.lengthMm / 150),
          'Finish outside contour walls from the extracted outer profile. Preview remains derived only and is not a final NC toolpath.',
        );
      } else {
        pushCandidate(
          'inside-contour',
          `Finish inside contour ${feature.name}`,
          'profile',
          operationMinutes(feature.lengthMm / 120),
          'Single inside contour cleanup retained conservatively because automatic pocket promotion was not certain and depth/bottom intent may still require review.',
        );
      }
      break;
    case 'pocket':
      pushCandidate(
        'pocket-rough',
        `Rough pocket ${feature.name}`,
        'pocket',
        operationMinutes((feature.areaMm2 * Math.max(feature.depthMm, 1)) / 9000),
        'Adaptive roughing on the bounded internal region with conservative floor-depth and step-down assumptions.',
      );
      pushCandidate(
        'pocket-finish',
        `Finish pocket ${feature.name}`,
        'pocket',
        operationMinutes((feature.lengthMm + feature.widthMm) / 80),
        'Finish pocket floor and walls after roughing. Preview fill is advisory only and not a true toolpath.',
      );
      break;
    case 'slot':
      pushCandidate(
        'slot',
        `Mill slot ${feature.name}`,
        'slot',
        operationMinutes((feature.lengthMm * feature.depthMm) / 180),
        'Centerline slotting with multiple depth passes using conservative slot-width and floor-depth assumptions.',
      );
      break;
    case 'hole_group':
      pushCandidate(
        'drill',
        `Drill ${feature.name}`,
        'drill',
        operationMinutes((feature.quantity * feature.depthMm) / 35),
        'Group holes by inferred diameter/pattern and drill them in a single conservative cycle. Through/blind depth intent and any follow-up thread, ream, or countersink work remain manual review items.',
      );
      break;
    case 'chamfer':
      pushCandidate(
        'chamfer',
        `Chamfer ${feature.name}`,
        'chamfer',
        operationMinutes(feature.lengthMm / 240),
        'Break exposed edges only with a shallow depth profile; no implicit deburr on hidden or unclassified edges.',
      );
      break;
    case 'engraving':
      pushCandidate(
        'engrave',
        `Engrave ${feature.name}`,
        'engrave',
        operationMinutes(feature.lengthMm / 90),
        'Single-line marking only with a shallow depth profile. Text preview remains a derived overlay and not a verified font path.',
      );
      break;
  }

  return candidates;
}

function operationSequenceWeight(operation: Operation): number {
  switch (operation.kind) {
    case 'face':
      return 0;
    case 'drill':
      return 1;
    case 'pocket':
      return operation.name.toLowerCase().includes('rough') ? 2 : 3;
    case 'slot':
      return 4;
    case 'profile':
      return operation.name.toLowerCase().includes('rough') ? 5 : 6;
    case 'chamfer':
      return 7;
    case 'engrave':
      return 8;
  }
}

export function planPart(input: PartInput): DraftCamPlan {
  const part = partInputSchema.parse(input);
  const features = normalizePart(part);
  const toolIds = new Set<string>();
  const risks: Risk[] = [];

  const operations = features
    .flatMap((feature) => {
      const selection = selectTool(feature);
      toolIds.add(selection.tool.id);
      risks.push(...featureRisks(feature, part));
      return buildOperationCandidates(feature, selection).map((candidate) => createOperation(candidate, feature, selection));
    })
    .sort((left, right) => {
      const weightDifference = operationSequenceWeight(left) - operationSequenceWeight(right);
      if (weightDifference !== 0) {
        return weightDifference;
      }
      return left.name.localeCompare(right.name);
    })
    .map((operation, index) => ({
      ...operation,
      order: index,
    }));

  const checklist = [
    {
      id: 'check-datum',
      title: 'Confirm workholding and datum scheme',
      rationale: 'The draft assumes a single top-side setup with stock faced before other machining.',
      status: 'pending' as const,
    },
    {
      id: 'check-tool-reach',
      title: 'Verify tool reach for deepest feature',
      rationale: 'Tool library is intentionally basic and should be checked against holder clearance and flute length.',
      status: 'pending' as const,
    },
    {
      id: 'check-material',
      title: 'Apply material-specific feeds and speeds',
      rationale: 'v2 estimates cycle time only and does not own production cutting data.',
      status: 'pending' as const,
    },
  ];

  if (part.holeGroups.length > 0) {
    checklist.push({
      id: 'check-holes',
      title: 'Confirm hole callouts and drill cycle',
      rationale: 'Hole grouping is deterministic by inferred diameter and simple patterning only. Thread, ream, countersink, and chamfer follow-up intent are still manual review items.',
      status: 'pending',
    });
  }

  if (features.some((feature) => feature.machiningIntent?.requiresReview)) {
    checklist.push({
      id: 'check-inferred-intent',
      title: 'Review inferred machining intent',
      rationale: 'At least one extracted feature remains confidence-limited, manually reclassified, or based on assumed 2D-only semantics.',
      status: 'pending',
    });
  }

  if (part.chamfers.length > 0) {
    checklist.push({
      id: 'check-deburr',
      title: 'Confirm chamfer and deburr scope',
      rationale: 'Only listed chamfer features are planned; implicit edge break assumptions should be reviewed.',
      status: 'pending',
    });
  }

  const estimatedCycleTimeMinutes = Number(
    operations.reduce((sum, operation) => sum + operation.estimatedMinutes, 0).toFixed(1),
  );
  const tools = defaultToolLibrary.tools.filter((tool) => toolIds.has(tool.id));

  return draftCamPlanSchema.parse({
    part,
    machineProfile: defaultMachineProfile,
    setups: defaultSetups,
    features,
    operationGroups: buildOperationGroups(operations, features),
    operations,
    toolLibrary: {
      ...defaultToolLibrary,
      tools,
    },
    tools,
    risks,
    checklist,
    estimatedCycleTimeMinutes: Math.max(estimatedCycleTimeMinutes, 0.5),
    approval: {
      state: risks.length > 0 ? 'in_review' : 'draft',
      requiresHumanApproval: true,
      notes: ['Deterministic CAM Operations v5 draft generated. Human review is required before release.'],
    },
    assumptions: [
      'Imported geometry remains 2D source interpretation only. This repo still does not implement a CAD kernel or B-Rep model.',
      'Generated operations are deterministic CAM authoring operations, not production G-code or final toolpaths.',
      'Operation preview is an operation preview layer only. It is not a verified NC tool motion output.',
      'Default tool library and machine profile are foundational examples, not a production tooling catalog.',
      'No toolpath engine, collision check, or postprocessor is active in this milestone.',
    ],
    summary: {
      featureCount: features.length,
      operationCount: operations.length,
      enabledOperationCount: operations.filter((operation) => operation.enabled).length,
      manualOperationCount: operations.filter((operation) => operation.origin === 'manual').length,
      highestRisk: highestRisk(risks),
    },
  });
}

export function buildPartInputFromDraftPlan(planInput: DraftCamPlan): PartInput {
  const plan = draftCamPlanSchema.parse(planInput);
  const featureSource = plan.features.filter(
    (feature) => feature.classificationState !== 'ignored'
      && !(feature.kind === 'contour' && feature.machiningIntent?.classification === 'ignored'),
  );

  return partInputSchema.parse({
    ...plan.part,
    topSurfaces: featureSource
      .filter((feature) => feature.kind === 'top_surface')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        areaMm2: Math.max(feature.areaMm2, 1),
        finish: 'face_milled' as const,
        ...copyFeatureMetadata(feature),
      })),
    contours: featureSource
      .filter((feature) => feature.kind === 'contour')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        lengthMm: Math.max(feature.lengthMm, 0.1),
        depthMm: Math.max(feature.depthMm, inferredDepthMm),
        ...copyFeatureMetadata(feature),
      })),
    pockets: featureSource
      .filter((feature) => feature.kind === 'pocket')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        lengthMm: Math.max(feature.lengthMm, 0.1),
        widthMm: Math.max(feature.widthMm, 0.1),
        depthMm: Math.max(feature.depthMm, inferredDepthMm),
        ...copyFeatureMetadata(feature),
      })),
    slots: featureSource
      .filter((feature) => feature.kind === 'slot')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        lengthMm: Math.max(feature.lengthMm, 0.1),
        widthMm: Math.max(feature.widthMm, 0.1),
        depthMm: Math.max(feature.depthMm, inferredDepthMm),
        ...copyFeatureMetadata(feature),
      })),
    holeGroups: featureSource
      .filter((feature) => feature.kind === 'hole_group')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        count: Math.max(feature.quantity, 1),
        diameterMm: Math.max(feature.lengthMm, 0.1),
        depthMm: Math.max(feature.depthMm, inferredDepthMm),
        pattern: 'custom' as const,
        ...copyFeatureMetadata(feature),
      })),
    chamfers: featureSource
      .filter((feature) => feature.kind === 'chamfer')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        lengthMm: Math.max(feature.lengthMm, 0.1),
        sizeMm: Math.max(feature.widthMm, 0.1),
        ...copyFeatureMetadata(feature),
      })),
    engraving: featureSource
      .filter((feature) => feature.kind === 'engraving')
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        text: feature.notes.find((note) => note.startsWith('Text: '))?.replace(/^Text:\s*/, '') ?? feature.name,
        lengthMm: Math.max(feature.lengthMm, 0.1),
        depthMm: Math.max(feature.depthMm, 0.1),
        ...copyFeatureMetadata(feature),
      })),
  });
}

export function regenerateDraftPlan(planInput: DraftCamPlan, options: RegenerationOptions = {}): DraftCamPlan {
  const plan = draftCamPlanSchema.parse(planInput);
  const basePlan = planPart(buildPartInputFromDraftPlan(plan));
  const existingOperationsById = new Map(plan.operations.map((operation) => [operation.id, operation]));
  const selectedFeatureIds = options.selectedFeatureIds && options.selectedFeatureIds.length > 0
    ? new Set(options.selectedFeatureIds)
    : null;

  const preservedExistingOperations = plan.operations.filter((operation) => {
    if (selectedFeatureIds && !selectedFeatureIds.has(operation.featureId)) {
      return true;
    }
    if (operation.origin === 'manual') {
      return true;
    }
    return Boolean(options.preserveFrozenEdited && operation.frozen);
  }).map((operation) => ({
    ...operation,
    source: determinePreservedOperationSource(operation),
  }));

  const regeneratedOperations = basePlan.operations
    .filter((operation) => (
      !selectedFeatureIds || selectedFeatureIds.has(operation.featureId)
    ))
    .map((operation) => withManualPathOverrides(
      existingOperationsById.get(operation.id),
      withManualDepthOverride(existingOperationsById.get(operation.id), operation),
    ));

  const mergedOperations = [...preservedExistingOperations, ...regeneratedOperations]
    .sort((left, right) => {
      const weightDifference = operationSequenceWeight(left) - operationSequenceWeight(right);
      if (weightDifference !== 0) {
        return weightDifference;
      }
      return left.name.localeCompare(right.name);
    })
    .map((operation, index) => ({
      ...operation,
      order: index,
    }));

  const mergedTools = defaultToolLibrary.tools.filter((tool) => mergedOperations.some((operation) => operation.toolId === tool.id));
  const mergedRisks = uniqueStrings([...basePlan.risks.map((risk) => risk.id), ...plan.risks.map((risk) => risk.id)])
    .map((id) => basePlan.risks.find((risk) => risk.id === id) ?? plan.risks.find((risk) => risk.id === id))
    .filter((risk): risk is Risk => Boolean(risk));

  return draftCamPlanSchema.parse({
    ...basePlan,
    operations: mergedOperations,
    operationGroups: buildOperationGroups(mergedOperations, basePlan.features),
    tools: mergedTools,
    risks: mergedRisks,
    estimatedCycleTimeMinutes: Math.max(sumEnabledMinutes(mergedOperations), 0.5),
    approval: {
      ...basePlan.approval,
      state: 'in_review',
      notes: uniqueStrings([
        ...basePlan.approval.notes,
        'Generated operations were regenerated from the current draft feature classifications. Human review is required before release.',
      ]),
    },
    summary: {
      ...basePlan.summary,
      operationCount: mergedOperations.length,
      enabledOperationCount: mergedOperations.filter((operation) => operation.enabled).length,
      manualOperationCount: mergedOperations.filter((operation) => operation.origin === 'manual').length,
      highestRisk: highestRisk(mergedRisks),
    },
  });
}

export function approvePlan(request: ApprovalRequest): DraftCamPlan {
  const parsed = approvalRequestSchema.parse(request);
  return draftCamPlanSchema.parse({
    ...parsed.plan,
    approval: {
      ...parsed.plan.approval,
      state: 'approved',
      requiresHumanApproval: true,
      approvedBy: parsed.approver,
      approvedAt: new Date().toISOString(),
      notes: parsed.notes ? [...parsed.plan.approval.notes, parsed.notes] : parsed.plan.approval.notes,
    },
  });
}

export { samplePartInput };
