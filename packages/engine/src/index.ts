import {
  approvalRequestSchema,
  buildOperationGroupId,
  buildOperationGroups,
  defaultMachineProfile,
  defaultSetups,
  defaultToolLibrary,
  draftCamPlanSchema,
  getSetupLabel,
  partInputSchema,
  samplePartInput,
  type ApprovalRequest,
  type DraftCamPlan,
  type NormalizedFeature,
  type Operation,
  type OperationKind,
  type PartInput,
  type Risk,
  type RiskLevel,
  type Tool,
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

function normalizePart(part: PartInput): NormalizedFeature[] {
  const features: NormalizedFeature[] = [];

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
    });
  });

  return features.sort(
    (left, right) => featureKindOrder.indexOf(left.kind) - featureKindOrder.indexOf(right.kind),
  );
}

function requireTool(toolId: string): Tool {
  const tool = defaultToolLibrary.tools.find((candidate) => candidate.id === toolId);
  if (!tool) {
    throw new Error(`Required tool ${toolId} is missing from the default tool library.`);
  }

  return tool;
}

function selectTool(feature: NormalizedFeature): Tool {
  switch (feature.kind) {
    case 'top_surface':
      return requireTool('tool-face-16');
    case 'contour':
    case 'pocket':
      return feature.widthMm > 0 && feature.widthMm <= narrowMillingWidthThresholdMm
        ? requireTool('tool-flat-6')
        : requireTool('tool-flat-10');
    case 'slot':
      return feature.widthMm <= narrowSlotWidthThresholdMm ? requireTool('tool-flat-6') : requireTool('tool-flat-10');
    case 'hole_group':
      return feature.lengthMm <= 3.5 ? requireTool('tool-drill-3') : requireTool('tool-drill-6');
    case 'chamfer':
      return requireTool('tool-chamfer-12');
    case 'engraving':
      return requireTool('tool-engrave-02');
  }
}

function operationMinutes(baseMinutes: number): number {
  return Math.max(Number(baseMinutes.toFixed(1)), 0.5);
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

export function extractGeometryFeatures(documentInput: Geometry2DDocument, graphInput?: GeometryGraph): GeometryFeatureExtractionResult {
  const document = geometry2DDocumentSchema.parse(documentInput);
  const graph = graphInput ? graphInput : buildGeometryGraph(document);
  const warnings = [...document.warnings.map((warning) => warning.message)];
  const features: GeometryFeatureInference[] = [];
  const containedLoopIds = new Set(graph.regions.flatMap((region) => region.innerLoopIds));
  const topLevelLoops = graph.loops.filter((loop) => !containedLoopIds.has(loop.id));
  const outerLoop = [...topLevelLoops].sort((left, right) => right.area - left.area)[0];

  if (!outerLoop) {
    warnings.push('No closed outer profile was detected. Draft planning will remain partial and may omit contour coverage.');
  }

  const closedLoopSet = new Set(graph.closedProfileIds);
  graph.loops.forEach((loop) => {
    const bounds = loop.bounds;
    const isCircle = loop.entityIds.length === 1 && document.entities.find((entity) => entity.id === loop.entityIds[0])?.type === 'circle';
    if (isCircle) {
      const id = `inference-hole-${features.length + 1}`;
      features.push({
        id,
        label: `Hole ${features.filter((feature) => feature.kind === 'hole_group').length + 1}`,
        kind: 'hole_group',
        mappedFeatureKind: 'hole_group',
        plannedFeatureId: id,
        sourceGeometryRefs: loop.entityIds,
        confidence: 0.98,
        inferenceMethod: 'circle entity preserved as a grouped hole candidate',
        warnings: ['Depth is not present in DXF. Hole depth defaults must be reviewed manually before release.'],
        bounds,
      });
      return;
    }

    if (!closedLoopSet.has(graph.profiles.find((profile) => profile.loopId === loop.id)?.id ?? '')) {
      return;
    }

    const inferenceWarnings: string[] = [];
    const topLevel = outerLoop?.id === loop.id;
    let kind: GeometryFeatureInferenceKind = topLevel ? 'outside_contour' : 'inside_contour';
    let mappedFeatureKind: GeometryFeatureInference['mappedFeatureKind'] = 'contour';
    let confidence = topLevel ? 0.92 : 0.68;
    let inferenceMethod = topLevel
      ? 'largest top-level closed loop promoted as the outside contour candidate'
      : 'closed loop preserved as an internal contour candidate';

    if (!topLevel && isElongated(bounds)) {
      kind = 'slot';
      mappedFeatureKind = 'slot';
      confidence = 0.74;
      inferenceMethod = 'elongated internal closed loop promoted as a slot candidate';
      inferenceWarnings.push('Slot classification is heuristic. Confirm wall style, tool diameter, and actual slot intent.');
    } else if (!topLevel && outerLoop) {
      kind = 'pocket';
      mappedFeatureKind = 'pocket';
      confidence = 0.82;
      inferenceMethod = 'internal closed loop nested inside the outside contour promoted as a pocket candidate';
      inferenceWarnings.push('Pocket depth is not encoded in DXF and defaults must be reviewed manually.');
    }

    features.push({
      id: `inference-${sanitizeId(kind)}-${features.length + 1}`,
      label:
        kind === 'outside_contour'
          ? 'Outside contour'
          : kind === 'inside_contour'
            ? `Inside contour ${features.filter((feature) => feature.kind === 'inside_contour').length + 1}`
            : `${kind.replace('_', ' ')} ${features.filter((feature) => feature.kind === kind).length + 1}`,
      kind,
      mappedFeatureKind,
      plannedFeatureId: `inference-${sanitizeId(kind)}-${features.length + 1}`,
      sourceGeometryRefs: loop.entityIds,
      confidence,
      inferenceMethod,
      warnings: inferenceWarnings,
      bounds,
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
      warnings: feature.warnings,
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
      warnings: feature.warnings,
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
      warnings: feature.warnings,
      origin: 'geometry_inferred' as const,
      classificationState: 'automatic' as const,
    }));

  const holeGroups = features
    .filter((feature) => feature.mappedFeatureKind === 'hole_group')
    .map((feature) => ({
      id: feature.plannedFeatureId,
      name: feature.label,
      count: 1,
      diameterMm: Math.max(feature.bounds.size.x, feature.bounds.size.y),
      depthMm: inferredDepthMm,
      pattern: 'custom' as const,
      sourceGeometryRefs: feature.sourceGeometryRefs,
      inferenceMethod: feature.inferenceMethod,
      confidence: feature.confidence,
      warnings: feature.warnings,
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
      warnings: feature.warnings,
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
  id: string,
  name: string,
  kind: OperationKind,
  feature: NormalizedFeature,
  tool: Tool,
  estimatedMinutes: number,
  strategy: string,
): Operation {
  const setup = getSetupLabel(defaultSetups, defaultSetupId);
  return {
    id,
    name,
    kind,
    featureId: feature.id,
    toolId: tool.id,
    toolName: tool.name,
    setupId: defaultSetupId,
    setup,
    groupId: buildOperationGroupId(defaultSetupId, feature.id),
    strategy,
    notes: '',
    estimatedMinutes,
    enabled: true,
    origin: 'automatic',
    order: 0,
    isDirty: false,
  };
}

export function planPart(input: PartInput): DraftCamPlan {
  const part = partInputSchema.parse(input);
  const features = normalizePart(part);
  const toolIds = new Set<string>();
  const risks: Risk[] = [];

  const operations = features
    .flatMap((feature, index) => {
      const tool = selectTool(feature);
      toolIds.add(tool.id);
      risks.push(...featureRisks(feature, part));

      switch (feature.kind) {
        case 'top_surface':
          return [
            createOperation(
              `op-${index + 1}-face`,
              `Face ${feature.name}`,
              'face',
              feature,
              tool,
              operationMinutes(feature.areaMm2 / 1800),
              'Face stock to establish Z datum.',
            ),
          ];
        case 'contour':
          return [
            createOperation(
              `op-${index + 1}-profile`,
              `Profile ${feature.name}`,
              'profile',
              feature,
              tool,
              operationMinutes(feature.lengthMm / 110),
              '2D contour with leave-on-finish stock for final wall cleanup.',
            ),
          ];
        case 'pocket':
          return [
            createOperation(
              `op-${index + 1}-pocket-rough`,
              `Rough pocket ${feature.name}`,
              'pocket',
              feature,
              tool,
              operationMinutes((feature.areaMm2 * Math.max(feature.depthMm, 1)) / 9000),
              'Adaptive roughing with conservative step-down.',
            ),
            createOperation(
              `op-${index + 1}-pocket-finish`,
              `Finish pocket ${feature.name}`,
              'pocket',
              feature,
              tool,
              operationMinutes((feature.lengthMm + feature.widthMm) / 80),
              'Finish floor and walls after roughing.',
            ),
          ];
        case 'slot':
          return [
            createOperation(
              `op-${index + 1}-slot`,
              `Mill slot ${feature.name}`,
              'slot',
              feature,
              tool,
              operationMinutes((feature.lengthMm * feature.depthMm) / 180),
              'Centerline slotting with multiple depth passes.',
            ),
          ];
        case 'hole_group':
          return [
            createOperation(
              `op-${index + 1}-drill`,
              `Drill ${feature.name}`,
              'drill',
              feature,
              tool,
              operationMinutes((feature.quantity * feature.depthMm) / 35),
              'Spot as needed and drill all holes in one grouped cycle.',
            ),
          ];
        case 'chamfer':
          return [
            createOperation(
              `op-${index + 1}-chamfer`,
              `Chamfer ${feature.name}`,
              'chamfer',
              feature,
              tool,
              operationMinutes(feature.lengthMm / 240),
              'Break exposed edges only; no implicit deburr on hidden edges.',
            ),
          ];
        case 'engraving':
          return [
            createOperation(
              `op-${index + 1}-engrave`,
              `Engrave ${feature.name}`,
              'engrave',
              feature,
              tool,
              operationMinutes(feature.lengthMm / 90),
              'Single-line marking only; no filled engraving or embossing.',
            ),
          ];
      }
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
      rationale: 'Hole group geometry is structured, but thread, ream, or countersink intent is not yet modeled.',
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
      notes: ['Deterministic draft generated. Human review is required before release.'],
    },
    assumptions: [
      'Derived manufacturing scene only: viewport geometry is arranged from structured JSON, not from a CAD kernel.',
      'Default tool library and machine profile are foundational examples, not a production catalog.',
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
