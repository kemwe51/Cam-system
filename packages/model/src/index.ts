import { z } from 'zod';
import {
  entityBounds,
  geometry2DDocumentSchema,
  geometryBoundsSchema,
  geometryGraphSchema,
  sampleEntityPoints,
  type Geometry2DDocument,
  type GeometryBounds,
  type GeometryGraph,
} from '@cam/geometry2d';
import {
  camReviewSchema,
  draftCamPlanSchema,
  selectedEntitySchema,
  type DraftCamPlan,
  type NormalizedFeature,
  type Operation,
  partInputSchema,
  type PartInput,
} from '@cam/shared';

const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
const isoDateTimeSchema = z.string().datetime();

export const viewModeSchema = z.enum(['shaded', 'wireframe', 'stock', 'features', 'operation_preview']);
export type ViewMode = z.infer<typeof viewModeSchema>;

export const viewPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  orientation: z.enum(['fit', 'top', 'front', 'right', 'isometric']),
  mode: viewModeSchema,
});
export type ViewPreset = z.infer<typeof viewPresetSchema>;

export const modelBoundsSchema = z.object({
  min: vector3Schema,
  max: vector3Schema,
  size: vector3Schema,
  center: vector3Schema,
});
export type ModelBounds = z.infer<typeof modelBoundsSchema>;

export const modelLayerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['source', 'stock', 'features', 'selection', 'operation_preview', 'imported_geometry', 'inferred_features']),
  visible: z.boolean().default(true),
});
export type ModelLayer = z.infer<typeof modelLayerSchema>;

export const modelSelectionSchema = z.object({
  kind: z.enum(['entity', 'feature', 'operation']),
  id: z.string().min(1),
  entityId: z.string().min(1).optional(),
  featureId: z.string().min(1).optional(),
  operationId: z.string().min(1).optional(),
});
export type ModelSelection = z.infer<typeof modelSelectionSchema>;

export const derivedGeometryFragmentSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  kind: z.enum([
    'box',
    'contour_path',
    'pocket_region',
    'hole_marker',
    'edge_marker',
    'text_marker',
    'generic_badge',
    'geometry_path',
    'geometry_region',
    'geometry_point',
  ]),
  position: vector3Schema,
  size: vector3Schema,
  label: z.string().min(1),
  text: z.string().optional(),
  color: z.string().min(1).default('#94a3b8'),
  points: z.array(vector3Schema).default([]),
  closed: z.boolean().default(false),
});
export type DerivedGeometryFragment = z.infer<typeof derivedGeometryFragmentSchema>;

export const modelEntitySchema = z.object({
  id: z.string().min(1),
  stableId: z.string().min(1),
  kind: z.enum(['stock', 'feature', 'source_geometry', 'operation_preview']),
  label: z.string().min(1),
  layerId: z.string().min(1),
  bounds: modelBoundsSchema,
  fragmentIds: z.array(z.string().min(1)).default([]),
  featureId: z.string().min(1).optional(),
  operationId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  selectable: z.boolean().default(true),
});
export type ModelEntity = z.infer<typeof modelEntitySchema>;

export const featureGeometryLinkSchema = z.object({
  id: z.string().min(1),
  featureId: z.string().min(1),
  entityId: z.string().min(1),
  fragmentIds: z.array(z.string().min(1)).default([]),
  sourceGeometryIds: z.array(z.string().min(1)).default([]),
  relationship: z.enum(['derived_feature', 'derived_from_source_metadata']),
});
export type FeatureGeometryLink = z.infer<typeof featureGeometryLinkSchema>;

export const extractedFeatureSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['outside_contour', 'inside_contour', 'pocket', 'hole_group', 'slot', 'engraving', 'unclassified']),
  mappedFeatureId: z.string().min(1).optional(),
  sourceGeometryRefs: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1),
  inferenceMethod: z.string().min(1),
  warnings: z.array(z.string()).default([]),
  bounds: geometryBoundsSchema,
  classificationState: z.enum(['automatic', 'manual_override', 'ignored']).default('automatic'),
});
export type ExtractedFeature = z.infer<typeof extractedFeatureSchema>;

export const operationPreviewSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  featureId: z.string().min(1),
  entityId: z.string().min(1).optional(),
  kind: z.enum(['contour_path', 'pocket_region', 'hole_marker', 'edge_marker', 'text_marker', 'generic_badge']),
  label: z.string().min(1),
  fragmentIds: z.array(z.string().min(1)).default([]),
  warnings: z.array(z.string()).default([]),
});
export type OperationPreview = z.infer<typeof operationPreviewSchema>;

export const modelViewSchema = z.object({
  bounds: modelBoundsSchema,
  layers: z.array(modelLayerSchema),
  entities: z.array(modelEntitySchema),
  presets: z.array(viewPresetSchema),
  defaultPresetId: z.string().min(1),
  defaultViewMode: viewModeSchema,
});
export type ModelView = z.infer<typeof modelViewSchema>;

export const modelSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['json', 'dxf', 'step', 'sample_json']),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  createdAt: isoDateTimeSchema,
  sourceGeometryMetadata: z.array(z.string()).default([]),
});
export type ModelSource = z.infer<typeof modelSourceSchema>;

export const importedModelSchema = z.object({
  id: z.string().min(1),
  source: modelSourceSchema,
  status: z.enum(['derived', 'placeholder']),
  warnings: z.array(z.string()).default([]),
  bounds: modelBoundsSchema,
  layers: z.array(modelLayerSchema),
  entities: z.array(modelEntitySchema),
  fragments: z.array(derivedGeometryFragmentSchema),
  featureGeometryLinks: z.array(featureGeometryLinkSchema),
  geometryDocument: geometry2DDocumentSchema.optional(),
  geometryGraph: geometryGraphSchema.optional(),
  extractedFeatures: z.array(extractedFeatureSchema).default([]),
  view: modelViewSchema,
  sourceGeometryMetadata: z.array(z.string()).default([]),
});
export type ImportedModel = z.infer<typeof importedModelSchema>;

export const importSessionRecordSchema = z.object({
  id: z.string().min(1),
  source: modelSourceSchema,
  importStatus: z.enum(['success', 'not_implemented']),
  warnings: z.array(z.string()).default([]),
  importedModel: importedModelSchema.optional(),
  deterministicPartInput: partInputSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type ImportSessionRecord = z.infer<typeof importSessionRecordSchema>;

export const planMetadataSchema = z.object({
  featureCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  enabledOperationCount: z.number().int().nonnegative(),
  manualOperationCount: z.number().int().nonnegative(),
  estimatedCycleTimeMinutes: z.number().positive(),
  highestRisk: z.enum(['low', 'medium', 'high']),
});
export type PlanMetadata = z.infer<typeof planMetadataSchema>;

export const projectRevisionRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  revision: z.number().int().positive(),
  sourceImportId: z.string().min(1).optional(),
  approvalState: z.enum(['draft', 'in_review', 'approved']),
  updatedAt: isoDateTimeSchema,
  warningCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  manualOperationCount: z.number().int().nonnegative(),
});
export type ProjectRevisionRecord = z.infer<typeof projectRevisionRecordSchema>;

export const projectRecordSchema = z.object({
  projectId: z.string().min(1),
  revision: z.number().int().positive(),
  sourceImportId: z.string().min(1).optional(),
  sourceType: modelSourceSchema.shape.type.optional(),
  sourceFilename: z.string().min(1).optional(),
  derivedModel: importedModelSchema.optional(),
  planMetadata: planMetadataSchema.optional(),
  approvalState: z.enum(['draft', 'in_review', 'approved']),
  updatedAt: isoDateTimeSchema,
  warnings: z.array(z.string()).default([]),
  plan: draftCamPlanSchema,
  review: camReviewSchema.optional(),
  selectedEntity: selectedEntitySchema.optional(),
  revisions: z.array(projectRevisionRecordSchema).default([]),
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

const defaultPresets: ViewPreset[] = [
  { id: 'preset-fit-shaded', label: 'Fit · shaded', orientation: 'fit', mode: 'shaded' },
  { id: 'preset-top-wireframe', label: 'Top · wireframe', orientation: 'top', mode: 'wireframe' },
  { id: 'preset-stock', label: 'Stock', orientation: 'isometric', mode: 'stock' },
  { id: 'preset-features', label: 'Features', orientation: 'fit', mode: 'features' },
  { id: 'preset-preview', label: 'Operation preview', orientation: 'fit', mode: 'operation_preview' },
];

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function featureStableId(kind: string, index: number, sourceId?: string): string {
  return sourceId ?? `${kind}-${index + 1}`;
}

function featureMetadata(source: Pick<
  PartInput['contours'][number],
  'sourceGeometryRefs' | 'inferenceMethod' | 'confidence' | 'warnings' | 'origin' | 'classificationState'
>) {
  return {
    sourceGeometryRefs: source.sourceGeometryRefs,
    ...(source.inferenceMethod ? { inferenceMethod: source.inferenceMethod } : {}),
    confidence: source.confidence,
    warnings: source.warnings,
    origin: source.origin,
    classificationState: source.classificationState,
  };
}

function boundsFromSize(size: [number, number, number], center: [number, number, number] = [0, 0, 0]): ModelBounds {
  const [sx, sy, sz] = size;
  const [cx, cy, cz] = center;
  const min: [number, number, number] = [cx - sx / 2, cy - sy / 2, cz - sz / 2];
  const max: [number, number, number] = [cx + sx / 2, cy + sy / 2, cz + sz / 2];
  return {
    min,
    max,
    size,
    center,
  };
}

function featureEnvelope(part: PartInput, feature: NormalizedFeature): [number, number, number] {
  switch (feature.kind) {
    case 'top_surface':
      return [Math.max(Math.sqrt(Math.max(feature.areaMm2, 1)), 10), Math.max(Math.sqrt(Math.max(feature.areaMm2, 1)), 10), 0.8];
    case 'contour':
      return [Math.max(feature.lengthMm * 0.55, part.stock.xMm * 0.3), Math.max(part.stock.yMm * 0.45, 8), Math.max(feature.depthMm, 0.8)];
    case 'pocket':
      return [Math.max(feature.lengthMm, 8), Math.max(feature.widthMm, 8), Math.max(feature.depthMm, 1)];
    case 'slot':
      return [Math.max(feature.lengthMm, 8), Math.max(feature.widthMm, 3), Math.max(feature.depthMm, 1)];
    case 'hole_group':
      return [Math.max(feature.lengthMm * Math.max(feature.quantity, 1), 4), Math.max(feature.widthMm * 2, 4), Math.max(feature.depthMm, 1)];
    case 'chamfer':
      return [Math.max(feature.lengthMm / 3, 8), Math.max(feature.widthMm * 4, 3), Math.max(feature.depthMm, 0.4)];
    case 'engraving':
      return [Math.max(feature.lengthMm, 8), Math.max(feature.widthMm * 10, 3), Math.max(feature.depthMm, 0.2)];
  }
}

function normalizeFeatures(part: PartInput): NormalizedFeature[] {
  const features: NormalizedFeature[] = [];
  part.topSurfaces.forEach((surface, index) => {
    const id = featureStableId('top-surface', index, surface.id);
    const side = Math.sqrt(surface.areaMm2);
    features.push({ id, sourceId: surface.id ?? id, name: surface.name, kind: 'top_surface', quantity: 1, depthMm: 0, lengthMm: side, widthMm: side, areaMm2: surface.areaMm2, notes: [`Finish target: ${surface.finish}`], ...featureMetadata(surface) });
  });
  part.contours.forEach((contour, index) => {
    const id = featureStableId('contour', index, contour.id);
    features.push({ id, sourceId: contour.id ?? id, name: contour.name, kind: 'contour', quantity: 1, depthMm: contour.depthMm, lengthMm: contour.lengthMm, widthMm: 0, areaMm2: contour.lengthMm * contour.depthMm, notes: ['Derived from structured contour metadata.'], ...featureMetadata(contour) });
  });
  part.pockets.forEach((pocket, index) => {
    const id = featureStableId('pocket', index, pocket.id);
    features.push({ id, sourceId: pocket.id ?? id, name: pocket.name, kind: 'pocket', quantity: 1, depthMm: pocket.depthMm, lengthMm: pocket.lengthMm, widthMm: pocket.widthMm, areaMm2: pocket.lengthMm * pocket.widthMm, notes: ['Derived pocket envelope only.'], ...featureMetadata(pocket) });
  });
  part.slots.forEach((slot, index) => {
    const id = featureStableId('slot', index, slot.id);
    features.push({ id, sourceId: slot.id ?? id, name: slot.name, kind: 'slot', quantity: 1, depthMm: slot.depthMm, lengthMm: slot.lengthMm, widthMm: slot.widthMm, areaMm2: slot.lengthMm * slot.widthMm, notes: ['Derived slot envelope only.'], ...featureMetadata(slot) });
  });
  part.holeGroups.forEach((holeGroup, index) => {
    const id = featureStableId('hole-group', index, holeGroup.id);
    features.push({ id, sourceId: holeGroup.id ?? id, name: holeGroup.name, kind: 'hole_group', quantity: holeGroup.count, depthMm: holeGroup.depthMm, lengthMm: holeGroup.diameterMm, widthMm: holeGroup.diameterMm, areaMm2: Math.PI * (holeGroup.diameterMm / 2) ** 2 * holeGroup.count, notes: [`Pattern: ${holeGroup.pattern}`], ...featureMetadata(holeGroup) });
  });
  part.chamfers.forEach((chamfer, index) => {
    const id = featureStableId('chamfer', index, chamfer.id);
    features.push({ id, sourceId: chamfer.id ?? id, name: chamfer.name, kind: 'chamfer', quantity: 1, depthMm: chamfer.sizeMm, lengthMm: chamfer.lengthMm, widthMm: chamfer.sizeMm, areaMm2: chamfer.lengthMm * chamfer.sizeMm, notes: ['Derived chamfer edge request only.'], ...featureMetadata(chamfer) });
  });
  part.engraving.forEach((engraving, index) => {
    const id = featureStableId('engraving', index, engraving.id);
    features.push({ id, sourceId: engraving.id ?? id, name: engraving.name, kind: 'engraving', quantity: 1, depthMm: engraving.depthMm, lengthMm: engraving.lengthMm, widthMm: 0.2, areaMm2: engraving.lengthMm * 0.2, notes: [`Text: ${engraving.text}`], ...featureMetadata(engraving) });
  });
  return features;
}

function featureColor(kind: NormalizedFeature['kind']): string {
  switch (kind) {
    case 'top_surface':
      return '#38bdf8';
    case 'contour':
      return '#22c55e';
    case 'pocket':
      return '#a855f7';
    case 'slot':
      return '#f59e0b';
    case 'hole_group':
      return '#e879f9';
    case 'chamfer':
      return '#fb7185';
    case 'engraving':
      return '#f97316';
  }
}

function geometryBoundsToModelBounds(bounds: GeometryBounds, zSize = 1, zCenter = 0): ModelBounds {
  const size: [number, number, number] = [Math.max(bounds.size.x, 0.1), Math.max(bounds.size.y, 0.1), zSize];
  const center: [number, number, number] = [bounds.center.x, bounds.center.y, zCenter];
  return boundsFromSize(size, center);
}

function pointsTo3d(points: Array<{ x: number; y: number }>, z = 0): Array<[number, number, number]> {
  return points.map((point) => [point.x, point.y, z]);
}

function hashColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 70% 60%)`;
}

function geometryFragmentKind(entity: Geometry2DDocument['entities'][number]): DerivedGeometryFragment['kind'] {
  switch (entity.type) {
    case 'point':
      return 'geometry_point';
    case 'text':
      return 'text_marker';
    case 'circle':
    case 'line':
    case 'arc':
    case 'polyline':
    case 'lwpolyline':
      return 'geometry_path';
    default:
      return 'generic_badge';
  }
}

function inferredFeatureFragmentKind(kind: ExtractedFeature['kind']): DerivedGeometryFragment['kind'] {
  switch (kind) {
    case 'outside_contour':
    case 'inside_contour':
      return 'contour_path';
    case 'pocket':
    case 'slot':
      return 'geometry_region';
    case 'hole_group':
      return 'hole_marker';
    case 'engraving':
      return 'text_marker';
    case 'unclassified':
      return 'generic_badge';
  }
}

export function createModelSource(
  input: Omit<ModelSource, 'createdAt' | 'sourceGeometryMetadata'> & {
    createdAt?: string;
    sourceGeometryMetadata?: string[];
  },
): ModelSource {
  return modelSourceSchema.parse({
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
    sourceGeometryMetadata: input.sourceGeometryMetadata ?? [],
  });
}

export function deriveImportedModelFromPart(source: ModelSource, part: PartInput, warnings: string[] = []): ImportedModel {
  const parsedSource = modelSourceSchema.parse(source);
  const parsedPart = partInputSchema.parse(part);
  const features = normalizeFeatures(parsedPart);
  const layers: ModelLayer[] = [
    { id: 'layer-source', label: 'Source metadata', kind: 'source', visible: true },
    { id: 'layer-stock', label: 'Stock', kind: 'stock', visible: true },
    { id: 'layer-features', label: 'Derived features', kind: 'features', visible: true },
    { id: 'layer-selection', label: 'Selection', kind: 'selection', visible: true },
    { id: 'layer-operation-preview', label: 'Operation preview', kind: 'operation_preview', visible: true },
  ];

  const fragments: DerivedGeometryFragment[] = [];
  const entities: ModelEntity[] = [];
  const featureGeometryLinks: FeatureGeometryLink[] = [];
  const bounds = boundsFromSize([parsedPart.stock.xMm, parsedPart.stock.yMm, parsedPart.stock.zMm]);

  const stockEntityId = `entity-stock-${sanitizeId(parsedPart.partId)}-${sanitizeId(parsedPart.revision)}`;
  const stockFragmentId = `fragment-${stockEntityId}`;
  fragments.push({
    id: stockFragmentId,
    entityId: stockEntityId,
    kind: 'box',
    position: bounds.center,
    size: bounds.size,
    label: 'Stock envelope',
    color: '#0f172a',
    points: [],
    closed: false,
  });
  entities.push({
    id: stockEntityId,
    stableId: stockEntityId,
    kind: 'stock',
    label: `${parsedPart.partName} stock`,
    layerId: 'layer-stock',
    bounds,
    fragmentIds: [stockFragmentId],
    metadata: { material: parsedPart.stock.material },
    selectable: false,
  });

  const columns = Math.max(Math.ceil(Math.sqrt(features.length || 1)), 1);
  const rows = Math.max(Math.ceil((features.length || 1) / columns), 1);
  const laneWidth = parsedPart.stock.xMm / columns;
  const laneHeight = parsedPart.stock.yMm / rows;
  const topZ = parsedPart.stock.zMm / 2;

  features.forEach((feature, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const size = featureEnvelope(parsedPart, feature);
    const center: [number, number, number] = [
      -parsedPart.stock.xMm / 2 + laneWidth * column + laneWidth / 2,
      parsedPart.stock.yMm / 2 - laneHeight * row - laneHeight / 2,
      topZ - Math.max(size[2] / 2, 0.4),
    ];
    const entityId = `entity-feature-${sanitizeId(feature.id)}`;
    const fragmentId = `fragment-${entityId}`;
    fragments.push({
      id: fragmentId,
      entityId,
      kind: feature.kind === 'contour' ? 'contour_path' : feature.kind === 'pocket' ? 'pocket_region' : feature.kind === 'hole_group' ? 'hole_marker' : feature.kind === 'chamfer' ? 'edge_marker' : feature.kind === 'engraving' ? 'text_marker' : 'box',
      position: center,
      size,
      label: feature.name,
      text: feature.kind === 'engraving' ? feature.notes.find((note) => note.startsWith('Text: '))?.replace('Text: ', '') : undefined,
      color: featureColor(feature.kind),
      points: [],
      closed: feature.kind === 'contour' || feature.kind === 'pocket',
    });
    entities.push({
      id: entityId,
      stableId: entityId,
      kind: 'feature',
      label: feature.name,
      layerId: 'layer-features',
      bounds: boundsFromSize(size, center),
      fragmentIds: [fragmentId],
      featureId: feature.id,
      metadata: {
        kind: feature.kind,
        sourceId: feature.sourceId,
        quantity: String(feature.quantity),
      },
      selectable: true,
    });
    featureGeometryLinks.push({
      id: `link-${sanitizeId(feature.id)}`,
      featureId: feature.id,
      entityId,
      fragmentIds: [fragmentId],
      sourceGeometryIds: feature.sourceGeometryRefs,
      relationship: 'derived_from_source_metadata',
    });
  });

  const sourceGeometryMetadata = [
    `Source type: ${parsedSource.type}`,
    `Stock: ${parsedPart.stock.xMm} × ${parsedPart.stock.yMm} × ${parsedPart.stock.zMm} mm ${parsedPart.stock.material}`,
    `Derived feature count: ${features.length}`,
    'Geometry remains derived metadata, not a CAD kernel or B-Rep.',
    ...parsedSource.sourceGeometryMetadata,
  ];

  const view: ModelView = {
    bounds,
    layers,
    entities,
    presets: defaultPresets,
    defaultPresetId: defaultPresets[0]?.id ?? 'preset-fit-shaded',
    defaultViewMode: 'shaded',
  };

  return importedModelSchema.parse({
    id: `model-${sanitizeId(parsedPart.partId)}-${sanitizeId(parsedPart.revision)}`,
    source: parsedSource,
    status: 'derived',
    warnings,
    bounds,
    layers,
    entities,
    fragments,
    featureGeometryLinks,
    extractedFeatures: [],
    view,
    sourceGeometryMetadata,
  });
}

export function deriveImportedModelFromGeometry(
  source: ModelSource,
  geometryDocumentInput: Geometry2DDocument,
  geometryGraphInput: GeometryGraph,
  extractedFeatureInputs: ExtractedFeature[],
  part: PartInput,
  warnings: string[] = [],
): ImportedModel {
  const parsedSource = modelSourceSchema.parse(source);
  const geometryDocument = geometry2DDocumentSchema.parse(geometryDocumentInput);
  const geometryGraph = geometryGraphSchema.parse(geometryGraphInput);
  const extractedFeatures = extractedFeatureInputs.map((feature) => extractedFeatureSchema.parse(feature));

  const layers: ModelLayer[] = [
    { id: 'layer-geometry', label: 'Imported 2D geometry', kind: 'imported_geometry', visible: true },
    { id: 'layer-stock', label: 'Assumed stock envelope', kind: 'stock', visible: true },
    { id: 'layer-features', label: 'Extracted features', kind: 'inferred_features', visible: true },
    { id: 'layer-selection', label: 'Selection', kind: 'selection', visible: true },
    { id: 'layer-operation-preview', label: 'Operation preview', kind: 'operation_preview', visible: true },
  ];

  const fragments: DerivedGeometryFragment[] = [];
  const entities: ModelEntity[] = [];
  const featureGeometryLinks: FeatureGeometryLink[] = [];

  const stockBounds = boundsFromSize(
    [part.stock.xMm, part.stock.yMm, part.stock.zMm],
    [geometryDocument.bounds.center.x, geometryDocument.bounds.center.y, 0],
  );
  const stockEntityId = `entity-stock-${sanitizeId(parsedSource.id)}`;
  const stockFragmentId = `fragment-${stockEntityId}`;
  fragments.push({
    id: stockFragmentId,
    entityId: stockEntityId,
    kind: 'box',
    position: stockBounds.center,
    size: stockBounds.size,
    label: 'DXF-derived stock envelope',
    color: '#0f172a',
    points: [],
    closed: false,
  });
  entities.push({
    id: stockEntityId,
    stableId: stockEntityId,
    kind: 'stock',
    label: `${part.partName} stock`,
    layerId: 'layer-stock',
    bounds: stockBounds,
    fragmentIds: [stockFragmentId],
    metadata: {
      material: part.stock.material,
      units: geometryDocument.units,
    },
    selectable: false,
  });

  geometryDocument.entities.forEach((entity) => {
    const fragmentId = `fragment-${entity.id}`;
    const points = sampleEntityPoints(entity);
    const bounds = geometryBoundsToModelBounds(entityBounds(entity), 0.2, 0);
    fragments.push({
      id: fragmentId,
      entityId: entity.id,
      kind: geometryFragmentKind(entity),
      position: [bounds.center[0], bounds.center[1], 0],
      size: [Math.max(bounds.size[0], 0.1), Math.max(bounds.size[1], 0.1), 0.2],
      label: `${entity.type} · ${geometryDocument.layers.find((layer) => layer.id === entity.layerId)?.name ?? entity.layerId}`,
      text: entity.type === 'text' ? entity.text : undefined,
      color: hashColor(entity.layerId),
      points: pointsTo3d(points),
      closed: entity.type === 'circle' || ((entity.type === 'polyline' || entity.type === 'lwpolyline') && entity.closed),
    });
    entities.push({
      id: entity.id,
      stableId: entity.stableId,
      kind: 'source_geometry',
      label: `${entity.type} · ${geometryDocument.layers.find((layer) => layer.id === entity.layerId)?.name ?? entity.layerId}`,
      layerId: 'layer-geometry',
      bounds,
      fragmentIds: [fragmentId],
      metadata: {
        type: entity.type,
        layerId: entity.layerId,
        layerName: geometryDocument.layers.find((layer) => layer.id === entity.layerId)?.name ?? entity.layerId,
      },
      selectable: true,
    });
  });

  extractedFeatures.forEach((feature) => {
    const entityId = `entity-feature-${sanitizeId(feature.id)}`;
    const fragmentId = `fragment-${entityId}`;
    const sourcePoints = feature.sourceGeometryRefs.flatMap((sourceId) => {
      const source = geometryDocument.entities.find((entity) => entity.id === sourceId);
      return source ? sampleEntityPoints(source) : [];
    });
    const bounds = geometryBoundsToModelBounds(feature.bounds, 0.5, 0.4);
    fragments.push({
      id: fragmentId,
      entityId,
      kind: inferredFeatureFragmentKind(feature.kind),
      position: [bounds.center[0], bounds.center[1], 0.4],
      size: [Math.max(bounds.size[0], 0.1), Math.max(bounds.size[1], 0.1), 0.5],
      label: feature.label,
      color: feature.kind === 'outside_contour' || feature.kind === 'inside_contour'
        ? '#22c55e'
        : feature.kind === 'pocket'
          ? '#a855f7'
          : feature.kind === 'slot'
            ? '#f59e0b'
            : feature.kind === 'hole_group'
              ? '#e879f9'
              : feature.kind === 'engraving'
                ? '#f97316'
                : '#94a3b8',
      points: pointsTo3d(sourcePoints, 0.4),
      closed: feature.kind !== 'engraving' && feature.kind !== 'unclassified',
    });
    entities.push({
      id: entityId,
      stableId: entityId,
      kind: 'feature',
      label: feature.label,
      layerId: 'layer-features',
      bounds,
      fragmentIds: [fragmentId],
      ...(feature.mappedFeatureId ? { featureId: feature.mappedFeatureId } : {}),
      metadata: {
        extractedKind: feature.kind,
        confidence: feature.confidence.toFixed(2),
        classificationState: feature.classificationState,
      },
      selectable: true,
    });
    if (feature.mappedFeatureId) {
      featureGeometryLinks.push({
        id: `link-${sanitizeId(feature.mappedFeatureId)}`,
        featureId: feature.mappedFeatureId,
        entityId,
        fragmentIds: [fragmentId],
        sourceGeometryIds: feature.sourceGeometryRefs,
        relationship: 'derived_feature',
      });
    }
  });

  const view: ModelView = {
    bounds: stockBounds,
    layers,
    entities,
    presets: [
      { id: 'preset-fit-shaded', label: 'Fit · shaded', orientation: 'fit', mode: 'shaded' },
      { id: 'preset-top-wireframe', label: 'Top · wireframe', orientation: 'top', mode: 'wireframe' },
      { id: 'preset-features', label: 'Features', orientation: 'top', mode: 'features' },
      { id: 'preset-preview', label: 'Operation preview', orientation: 'top', mode: 'operation_preview' },
    ],
    defaultPresetId: 'preset-top-wireframe',
    defaultViewMode: 'wireframe',
  };

  const sourceGeometryMetadata = [
    `DXF units: ${geometryDocument.units}`,
    `Imported entities: ${geometryDocument.entities.length}`,
    `Open profiles: ${geometryGraph.openProfileIds.length}`,
    `Closed profiles: ${geometryGraph.closedProfileIds.length}`,
    `Extracted features: ${extractedFeatures.length}`,
    `Unclassified geometry: ${geometryDocument.entities.filter((entity) => !extractedFeatures.some((feature) => feature.sourceGeometryRefs.includes(entity.id))).length}`,
    'Imported geometry remains 2D source interpretation only. No CAD kernel, no B-Rep, and no true toolpath generation are implied.',
    ...parsedSource.sourceGeometryMetadata,
  ];

  return importedModelSchema.parse({
    id: `model-${sanitizeId(parsedSource.id)}`,
    source: parsedSource,
    status: 'derived',
    warnings,
    bounds: stockBounds,
    layers,
    entities,
    fragments,
    featureGeometryLinks,
    geometryDocument,
    geometryGraph,
    extractedFeatures,
    view,
    sourceGeometryMetadata,
  });
}

export function createPlaceholderImportedModel(source: ModelSource, warning: string): ImportedModel {
  const parsedSource = modelSourceSchema.parse(source);
  const bounds = boundsFromSize([1, 1, 1]);
  const layers: ModelLayer[] = [
    { id: 'layer-source', label: 'Source metadata', kind: 'source', visible: true },
    { id: 'layer-stock', label: 'Stock', kind: 'stock', visible: false },
    { id: 'layer-features', label: 'Derived features', kind: 'features', visible: false },
    { id: 'layer-selection', label: 'Selection', kind: 'selection', visible: true },
    { id: 'layer-operation-preview', label: 'Operation preview', kind: 'operation_preview', visible: false },
  ];
  const view: ModelView = {
    bounds,
    layers,
    entities: [],
    presets: defaultPresets,
    defaultPresetId: defaultPresets[0]?.id ?? 'preset-fit-shaded',
    defaultViewMode: 'wireframe',
  };

  return importedModelSchema.parse({
    id: `model-placeholder-${sanitizeId(parsedSource.id)}`,
    source: parsedSource,
    status: 'placeholder',
    warnings: [warning],
    bounds,
    layers,
    entities: [],
    fragments: [],
    featureGeometryLinks: [],
    extractedFeatures: [],
    view,
    sourceGeometryMetadata: [
      `Source type: ${parsedSource.type}`,
      'Placeholder import session only. Real geometry parsing is not implemented yet.',
    ],
  });
}

function previewKind(operation: Operation): OperationPreview['kind'] {
  switch (operation.kind) {
    case 'profile':
      return 'contour_path';
    case 'pocket':
    case 'slot':
    case 'face':
      return 'pocket_region';
    case 'drill':
      return 'hole_marker';
    case 'chamfer':
      return 'edge_marker';
    case 'engrave':
      return 'text_marker';
    default:
      return 'generic_badge';
  }
}

export function deriveOperationPreviews(model: ImportedModel, operations: DraftCamPlan['operations']): OperationPreview[] {
  const links = new Map(model.featureGeometryLinks.map((link) => [link.featureId, link]));
  return operations.map((operation) => {
    const link = links.get(operation.featureId);
    const warnings = !link
      ? ['No derived geometry link is available for this operation preview. Rendering generic preview only.']
      : operation.origin === 'manual'
        ? ['Manual operation preview is advisory only and may not match deterministic feature coverage.']
        : [];
    return operationPreviewSchema.parse({
      id: `preview-${sanitizeId(operation.id)}`,
      operationId: operation.id,
      featureId: operation.featureId,
      entityId: link?.entityId,
      kind: previewKind(operation),
      label: operation.name,
      fragmentIds: link?.fragmentIds ?? [],
      warnings,
    });
  });
}

export function buildPlanMetadata(plan: DraftCamPlan) {
  return planMetadataSchema.parse({
    featureCount: plan.summary.featureCount,
    operationCount: plan.summary.operationCount,
    enabledOperationCount: plan.summary.enabledOperationCount,
    manualOperationCount: plan.summary.manualOperationCount,
    estimatedCycleTimeMinutes: plan.estimatedCycleTimeMinutes,
    highestRisk: plan.summary.highestRisk,
  });
}

export function buildProjectRevisionRecord(projectId: string, revision: number, plan: DraftCamPlan, sourceImportId?: string, warningCount = 0, updatedAt = new Date().toISOString()): ProjectRevisionRecord {
  return projectRevisionRecordSchema.parse({
    id: `project-revision-${sanitizeId(projectId)}-${revision}`,
    projectId,
    revision,
    sourceImportId,
    approvalState: plan.approval.state,
    updatedAt,
    warningCount,
    operationCount: plan.operations.length,
    manualOperationCount: plan.operations.filter((operation) => operation.origin === 'manual').length,
  });
}
