import {
  approvalRequestSchema,
  draftCamPlanSchema,
  partInputSchema,
  samplePartInput,
  type ApprovalRequest,
  type DraftCamPlan,
  type NormalizedFeature,
  type PartInput,
  type Risk,
  type RiskLevel,
  type Tool,
} from '@cam/shared';

const faceMillTool: Tool = {
  id: 'tool-face-16',
  name: '16 mm face mill',
  type: 'face_mill',
  diameterMm: 16,
  maxDepthMm: 2,
  material: 'carbide',
};

const flatEndMill10Tool: Tool = {
  id: 'tool-flat-10',
  name: '10 mm flat end mill',
  type: 'flat_end_mill',
  diameterMm: 10,
  maxDepthMm: 18,
  material: 'carbide',
};

const flatEndMill6Tool: Tool = {
  id: 'tool-flat-6',
  name: '6 mm flat end mill',
  type: 'flat_end_mill',
  diameterMm: 6,
  maxDepthMm: 20,
  material: 'carbide',
};

const drill6Tool: Tool = {
  id: 'tool-drill-6',
  name: '6 mm carbide drill',
  type: 'drill',
  diameterMm: 6,
  maxDepthMm: 24,
  material: 'carbide',
};

const drill3Tool: Tool = {
  id: 'tool-drill-3',
  name: '3 mm carbide drill',
  type: 'drill',
  diameterMm: 3,
  maxDepthMm: 12,
  material: 'carbide',
};

const chamferTool: Tool = {
  id: 'tool-chamfer-12',
  name: '12 mm chamfer mill',
  type: 'chamfer_mill',
  diameterMm: 12,
  maxDepthMm: 3,
  material: 'carbide',
};

const engraverTool: Tool = {
  id: 'tool-engrave-02',
  name: '0.2 mm engraving tool',
  type: 'engraver',
  diameterMm: 0.2,
  maxDepthMm: 1,
  material: 'carbide',
};

const toolLibrary: Tool[] = [
  faceMillTool,
  flatEndMill10Tool,
  flatEndMill6Tool,
  drill6Tool,
  drill3Tool,
  chamferTool,
  engraverTool,
];

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
      notes: ['Pocket kept rectangular in v1; no freeform geometry is assumed.'],
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
    (left, right) =>
      featureKindOrder.indexOf(left.kind) - featureKindOrder.indexOf(right.kind),
  );
}

function selectTool(feature: NormalizedFeature): Tool {
  switch (feature.kind) {
    case 'top_surface':
      return faceMillTool;
    case 'contour':
    case 'pocket':
      return feature.widthMm > 0 && feature.widthMm <= narrowMillingWidthThresholdMm
        ? flatEndMill6Tool
        : flatEndMill10Tool;
    case 'slot':
      return feature.widthMm <= narrowSlotWidthThresholdMm ? flatEndMill6Tool : flatEndMill10Tool;
    case 'hole_group':
      return feature.lengthMm <= 3.5 ? drill3Tool : drill6Tool;
    case 'chamfer':
      return chamferTool;
    case 'engraving':
      return engraverTool;
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

export function planPart(input: PartInput): DraftCamPlan {
  const part = partInputSchema.parse(input);
  const features = normalizePart(part);
  const toolsById = new Map<string, Tool>();
  const risks: Risk[] = [];

  const operations = features.flatMap((feature, index) => {
    const tool = selectTool(feature);
    toolsById.set(tool.id, tool);
    risks.push(...featureRisks(feature, part));

    switch (feature.kind) {
      case 'top_surface':
        return [
          {
            id: `op-${index + 1}-face`,
            name: `Face ${feature.name}`,
            kind: 'face',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Face stock to establish Z datum.',
            estimatedMinutes: operationMinutes(feature.areaMm2 / 1800),
          },
        ];
      case 'contour':
        return [
          {
            id: `op-${index + 1}-profile`,
            name: `Profile ${feature.name}`,
            kind: 'profile',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: '2D contour with leave-on-finish stock for final wall cleanup.',
            estimatedMinutes: operationMinutes(feature.lengthMm / 110),
          },
        ];
      case 'pocket':
        return [
          {
            id: `op-${index + 1}-pocket-rough`,
            name: `Rough pocket ${feature.name}`,
            kind: 'pocket',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Adaptive roughing with conservative step-down.',
            estimatedMinutes: operationMinutes((feature.areaMm2 * Math.max(feature.depthMm, 1)) / 9000),
          },
          {
            id: `op-${index + 1}-pocket-finish`,
            name: `Finish pocket ${feature.name}`,
            kind: 'pocket',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Finish floor and walls after roughing.',
            estimatedMinutes: operationMinutes((feature.lengthMm + feature.widthMm) / 80),
          },
        ];
      case 'slot':
        return [
          {
            id: `op-${index + 1}-slot`,
            name: `Mill slot ${feature.name}`,
            kind: 'slot',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Centerline slotting with multiple depth passes.',
            estimatedMinutes: operationMinutes((feature.lengthMm * feature.depthMm) / 180),
          },
        ];
      case 'hole_group':
        return [
          {
            id: `op-${index + 1}-drill`,
            name: `Drill ${feature.name}`,
            kind: 'drill',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Spot as needed and drill all holes in one grouped cycle.',
            estimatedMinutes: operationMinutes((feature.quantity * feature.depthMm) / 35),
          },
        ];
      case 'chamfer':
        return [
          {
            id: `op-${index + 1}-chamfer`,
            name: `Chamfer ${feature.name}`,
            kind: 'chamfer',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Break exposed edges only; no implicit deburr on hidden edges.',
            estimatedMinutes: operationMinutes(feature.lengthMm / 240),
          },
        ];
      case 'engraving':
        return [
          {
            id: `op-${index + 1}-engrave`,
            name: `Engrave ${feature.name}`,
            kind: 'engrave',
            featureId: feature.id,
            toolId: tool.id,
            toolName: tool.name,
            setup: 'Setup 1 / Top side',
            strategy: 'Single-line marking only; no filled engraving or embossing.',
            estimatedMinutes: operationMinutes(feature.lengthMm / 90),
          },
        ];
    }
  });

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
      rationale: 'v1 estimates cycle time only and does not own production cutting data.',
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
    operations
      .reduce((sum, operation) => sum + operation.estimatedMinutes, 0)
      .toFixed(1),
  );

  return draftCamPlanSchema.parse({
    part,
    features,
    operations,
    tools: [...toolsById.values()],
    risks,
    checklist,
    estimatedCycleTimeMinutes: Math.max(estimatedCycleTimeMinutes, 0.5),
    approval: {
      state: risks.length > 0 ? 'in_review' : 'draft',
      requiresHumanApproval: true,
      notes: ['Deterministic draft generated. Human review is required before release.'],
    },
    assumptions: [
      'Input is structured JSON and already references intended manufacturing features.',
      'No geometry kernel, toolpath verification, collision detection, or G-code output is implemented in v1.',
      'Operation sequencing assumes one primary top-side setup.',
    ],
    summary: {
      featureCount: features.length,
      operationCount: operations.length,
      highestRisk: highestRisk(risks),
    },
  });
}

export function approvePlan(request: ApprovalRequest): DraftCamPlan {
  const parsed = approvalRequestSchema.parse(request);
  const approvalNotes = [...parsed.plan.approval.notes];

  if (parsed.notes) {
    approvalNotes.push(parsed.notes);
  }

  return draftCamPlanSchema.parse({
    ...parsed.plan,
    approval: {
      state: 'approved',
      requiresHumanApproval: false,
      approvedBy: parsed.approver,
      approvedAt: new Date().toISOString(),
      notes: approvalNotes,
    },
  });
}

export { samplePartInput };
