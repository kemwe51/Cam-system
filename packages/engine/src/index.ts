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

  return risks;
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
