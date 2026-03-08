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
  pathPreviewModeSchema,
  draftCamPlanSchema,
  operationDepthProfileSchema,
  operationPathProfileSchema,
  previewPathSchema,
  selectedEntitySchema,
  type DraftCamPlan,
  type NormalizedFeature,
  type Operation,
  type OperationPathProfile,
  type PathPlan,
  type PathPlanSegment,
  type PreviewPath,
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
  source: z.enum(['generated', 'manual', 'edited']).default('generated'),
  fragmentIds: z.array(z.string().min(1)).default([]),
  paths: z.array(previewPathSchema).default([]),
  pathPreviewMode: pathPreviewModeSchema.default('summary'),
  pathProfile: operationPathProfileSchema.optional(),
  depthProfile: operationDepthProfileSchema.optional(),
  depthAnnotations: z.array(z.string().min(1)).default([]),
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

export const nativeWorkbenchNodeSchema = z.object({
  id: z.string().min(1),
  stableId: z.string().min(1),
  kind: z.enum(['project', 'collection', 'source', 'model_entity', 'feature', 'operation', 'tool', 'operation_preview']),
  label: z.string().min(1),
  parentId: z.string().min(1).optional(),
  status: z.enum(['ready', 'warning', 'placeholder']).default('ready'),
  entityId: z.string().min(1).optional(),
  featureId: z.string().min(1).optional(),
  operationId: z.string().min(1).optional(),
  toolId: z.string().min(1).optional(),
  previewId: z.string().min(1).optional(),
  sourceGeometryIds: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
});
export type NativeWorkbenchNode = z.infer<typeof nativeWorkbenchNodeSchema>;

export const nativeWorkbenchSelectionLinkSchema = z.object({
  id: z.string().min(1),
  syncChannels: z.array(z.enum(['model_tree', 'features', 'operations', 'tools', 'viewport', 'inspector', 'warnings'])).default([]),
  modelEntityNodeId: z.string().min(1).optional(),
  featureNodeId: z.string().min(1).optional(),
  operationNodeId: z.string().min(1).optional(),
  toolNodeId: z.string().min(1).optional(),
  previewNodeId: z.string().min(1).optional(),
  sourceGeometryIds: z.array(z.string().min(1)).default([]),
});
export type NativeWorkbenchSelectionLink = z.infer<typeof nativeWorkbenchSelectionLinkSchema>;

export const nativeWorkbenchSnapshotSchema = z.object({
  schemaVersion: z.literal('native-workbench-v1'),
  projectId: z.string().min(1),
  revision: z.number().int().positive(),
  approvalState: z.enum(['draft', 'in_review', 'approved']),
  sourceType: modelSourceSchema.shape.type.optional(),
  sourceImportId: z.string().min(1).optional(),
  importedModelId: z.string().min(1).optional(),
  view: modelViewSchema.optional(),
  warnings: z.array(z.string()).default([]),
  nodes: z.array(nativeWorkbenchNodeSchema),
  selectionLinks: z.array(nativeWorkbenchSelectionLinkSchema),
  metadata: z.object({
    featureCount: z.number().int().nonnegative(),
    extractedFeatureCount: z.number().int().nonnegative(),
    operationCount: z.number().int().nonnegative(),
    toolCount: z.number().int().nonnegative(),
    previewCount: z.number().int().nonnegative(),
    hasPlaceholderModel: z.boolean(),
  }),
});
export type NativeWorkbenchSnapshot = z.infer<typeof nativeWorkbenchSnapshotSchema>;

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

function previewOutline(position: [number, number, number], size: [number, number, number]): Array<[number, number, number]> {
  const halfX = Math.max(size[0] / 2, 0.5);
  const halfY = Math.max(size[1] / 2, 0.5);
  const z = position[2] + size[2] / 2 + 0.6;
  return [
    [position[0] - halfX, position[1] - halfY, z],
    [position[0] + halfX, position[1] - halfY, z],
    [position[0] + halfX, position[1] + halfY, z],
    [position[0] - halfX, position[1] + halfY, z],
    [position[0] - halfX, position[1] - halfY, z],
  ];
}

function roundNumber(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function featureTopZ(fragment?: DerivedGeometryFragment, entity?: ModelEntity): number {
  const position = fragment?.position ?? entity?.bounds.center ?? [0, 0, 0];
  const size = fragment?.size ?? entity?.bounds.size ?? [0, 0, 0];
  return position[2] + size[2] / 2;
}

function transformPathPoint(
  point: [number, number, number],
  pathPlan: PathPlan,
  fragment?: DerivedGeometryFragment,
  entity?: ModelEntity,
): [number, number, number] {
  if (pathPlan.coordinateReference === 'setup_top') {
    return point;
  }

  const position = fragment?.position ?? entity?.bounds.center ?? [0, 0, 0];
  const size = fragment?.size ?? entity?.bounds.size ?? [8, 8, 1];
  const topZ = featureTopZ(fragment, entity);
  return [
    roundNumber(position[0] + point[0] * Math.max(size[0], 1)),
    roundNumber(position[1] + point[1] * Math.max(size[1], 1)),
    roundNumber(topZ + point[2]),
  ];
}

function previewSegmentKind(segment: PathPlanSegment, operation: Operation): PreviewPath['segments'][number]['kind'] {
  if (operation.kind === 'drill') {
    return segment.motionType === 'plunge_move' ? 'marker' : 'line';
  }
  if (operation.kind === 'slot') {
    return 'centerline';
  }
  if (operation.kind === 'pocket' && segment.motionType === 'feed_move' && segment.label?.toLowerCase().includes('lane')) {
    return 'centerline';
  }
  return segment.kind === 'arc' ? 'arc' : 'line';
}

function pathPlanPreviewPaths(
  operation: Operation,
  previewId: string,
  pathProfile: OperationPathProfile,
  fragment?: DerivedGeometryFragment,
  entity?: ModelEntity,
): PreviewPath[] {
  return pathProfile.pathPlans.map((pathPlan) =>
    previewPathSchema.parse({
      id: `${previewId}-${pathPlan.id}`,
      operationId: operation.id,
      featureId: operation.featureId,
      label: pathPlan.label,
      source: operation.origin === 'manual' ? 'manual' : 'generated',
      segments: pathPlan.segments.map((segment) => {
        const points = segment.points.map((point) => transformPathPoint(point, pathPlan, fragment, entity));
        const firstPoint = points[0];
        const lastPoint = points.at(-1);
        const closed = Boolean(firstPoint && lastPoint && firstPoint.every((value, index) => value === lastPoint[index]));
        return {
          id: `${previewId}-${segment.id}`,
          kind: previewSegmentKind(segment, operation),
          points,
          closed,
          ...(segment.label ? { label: segment.label } : {}),
          ...(pathPlan.targetDepthMm !== undefined ? { depthAnnotation: `Z ${pathPlan.targetDepthMm.toFixed(1)} mm` } : {}),
          motionType: segment.motionType,
          pathPlanId: pathPlan.id,
          pathSegmentId: segment.id,
        };
      }),
    }));
}

function buildPreviewPaths(
  operation: Operation,
  previewId: string,
  fragment?: DerivedGeometryFragment,
  entity?: ModelEntity,
): PreviewPath[] {
  if (operation.pathProfile?.pathPlans.length) {
    return pathPlanPreviewPaths(operation, previewId, operation.pathProfile, fragment, entity);
  }

  const position = fragment?.position ?? entity?.bounds.center ?? [0, 0, 0];
  const size = fragment?.size ?? entity?.bounds.size ?? [8, 8, 1];
  const segments = fragment?.points.length && fragment.points.length >= 2
    ? [{
        id: `${previewId}-segment-1`,
        kind:
          operation.kind === 'slot'
            ? 'centerline'
            : operation.kind === 'drill'
              ? 'marker'
              : operation.kind === 'pocket' || operation.kind === 'face'
                ? 'region'
                : 'line',
        points: fragment.points,
        closed: fragment.closed,
        ...(fragment.label ? { label: fragment.label } : {}),
        ...(operation.depthProfile?.targetDepthMm !== undefined ? { depthAnnotation: `Z ${operation.depthProfile.targetDepthMm.toFixed(1)} mm` } : {}),
      }]
    : [{
        id: `${previewId}-segment-1`,
        kind:
          operation.kind === 'drill'
            ? 'marker'
            : operation.kind === 'slot'
              ? 'centerline'
              : operation.kind === 'pocket' || operation.kind === 'face'
                ? 'region'
                : 'line',
        points: previewOutline(position, size),
        closed: operation.kind !== 'drill',
        ...(operation.depthProfile?.targetDepthMm !== undefined ? { depthAnnotation: `Z ${operation.depthProfile.targetDepthMm.toFixed(1)} mm` } : {}),
      }];

  return [
    previewPathSchema.parse({
      id: `${previewId}-path-1`,
      operationId: operation.id,
      featureId: operation.featureId,
      label: operation.name,
      source: operation.origin === 'manual' ? 'manual' : 'generated',
      segments,
    }),
  ];
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
  const entityMap = new Map(model.entities.map((entity) => [entity.id, entity]));
  const fragmentMap = new Map(model.fragments.map((fragment) => [fragment.id, fragment]));
  return operations.map((operation) => {
    const link = links.get(operation.featureId);
    const entity = link?.entityId ? entityMap.get(link.entityId) : undefined;
    const fragment = link?.fragmentIds[0] ? fragmentMap.get(link.fragmentIds[0]) : undefined;
    const previewId = `preview-${sanitizeId(operation.id)}`;
    const warnings = !link
      ? ['No derived geometry link is available for this operation preview. Rendering generic preview only.']
      : operation.origin === 'manual'
        ? ['Manual operation preview is advisory only and may not match deterministic feature coverage.']
        : operation.source === 'edited'
          ? ['Edited generated operation preview is derived from the linked geometry and should be re-reviewed after regeneration changes.']
          : [];
    const depthAnnotations = [
      ...(operation.depthProfile?.targetDepthMm !== undefined
        ? [`Target depth ${operation.depthProfile.targetDepthMm.toFixed(1)} mm below stock top.`]
        : []),
      ...(operation.depthProfile?.bottomReference
        ? [`Bottom behavior ${operation.depthProfile.bottomReference.behavior.replaceAll('_', ' ')}.`]
        : []),
      ...(operation.depthProfile?.floorLevel
        ? [`Floor level Z ${operation.depthProfile.floorLevel.zMm.toFixed(1)} mm.`]
        : []),
      ...(operation.depthProfile?.passDepthPlan
        ? [`${operation.depthProfile.passDepthPlan.roughingLayerCount} planning depth layer(s), finish ${operation.depthProfile.passDepthPlan.finishPass.replaceAll('_', ' ')}.`]
        : []),
      ...(operation.depthProfile?.overridePreserved
        ? ['Manual depth override preserved during regeneration.']
        : []),
      ...(operation.depthProfile?.assumptions.map((assumption) => assumption.label) ?? []),
      ...(operation.pathProfile?.pathPlans.length
        ? [`${operation.pathProfile.pathPlans.length} deterministic path candidate plan(s) derived for review.`]
        : []),
      ...(operation.pathProfile?.warnings.map((warning) => warning.message) ?? []),
      ...(operation.pathProfile?.assumptions.map((assumption) => assumption.label) ?? []),
    ];
    return operationPreviewSchema.parse({
      id: previewId,
      operationId: operation.id,
      featureId: operation.featureId,
      entityId: link?.entityId,
      kind: previewKind(operation),
      label: operation.name,
      source: operation.source,
      fragmentIds: link?.fragmentIds ?? [],
      paths: buildPreviewPaths(operation, previewId, fragment, entity),
      pathPreviewMode: operation.pathProfile?.previewMode ?? 'summary',
      pathProfile: operation.pathProfile,
      depthProfile: operation.depthProfile,
      depthAnnotations,
      warnings: [...warnings, ...(operation.pathProfile?.warnings.map((warning) => warning.message) ?? [])],
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

export function buildNativeWorkbenchSnapshot(project: ProjectRecord): NativeWorkbenchSnapshot {
  const projectNodeId = `node-project-${sanitizeId(project.projectId)}`;
  const sourceNodeId = project.sourceImportId ? `node-source-${sanitizeId(project.sourceImportId)}` : undefined;
  const modelCollectionId = `${projectNodeId}-collection-model-tree`;
  const featuresCollectionId = `${projectNodeId}-collection-features`;
  const operationsCollectionId = `${projectNodeId}-collection-operations`;
  const toolsCollectionId = `${projectNodeId}-collection-tools`;
  const previewsCollectionId = `${projectNodeId}-collection-path-previews`;
  const model = project.derivedModel;
  const plan = project.plan;
  const operationPreviews = model ? deriveOperationPreviews(model, plan.operations) : [];
  const featureLinksByFeatureId = new Map((model?.featureGeometryLinks ?? []).map((link) => [link.featureId, link]));
  const previewByOperationId = new Map(operationPreviews.map((preview) => [preview.operationId, preview]));
  const entityNodeIds = new Map<string, string>();
  const featureNodeIds = new Map<string, string>();
  const operationNodeIds = new Map<string, string>();
  const toolNodeIds = new Map<string, string>();
  const previewNodeIds = new Map<string, string>();
  const catalog = plan.toolLibrary.tools.length > 0 ? plan.toolLibrary.tools : plan.tools;
  const usedToolIds = new Set(plan.operations.map((operation) => operation.toolId));
  const usedTools = catalog.filter((tool) => usedToolIds.has(tool.id));

  const nodes: NativeWorkbenchNode[] = [
    nativeWorkbenchNodeSchema.parse({
      id: projectNodeId,
      stableId: project.projectId,
      kind: 'project',
      label: project.sourceFilename ? `${project.projectId} · ${project.sourceFilename}` : project.projectId,
      status: project.warnings.length > 0 ? 'warning' : 'ready',
      metadata: {
        revision: String(project.revision),
        approvalState: project.approvalState,
      },
    }),
    nativeWorkbenchNodeSchema.parse({
      id: modelCollectionId,
      stableId: `${project.projectId}:model-tree`,
      kind: 'collection',
      label: 'Model tree',
      parentId: projectNodeId,
      status: model?.status === 'placeholder' ? 'placeholder' : 'ready',
    }),
    nativeWorkbenchNodeSchema.parse({
      id: featuresCollectionId,
      stableId: `${project.projectId}:features`,
      kind: 'collection',
      label: 'Features',
      parentId: projectNodeId,
    }),
    nativeWorkbenchNodeSchema.parse({
      id: operationsCollectionId,
      stableId: `${project.projectId}:operations`,
      kind: 'collection',
      label: 'Operations',
      parentId: projectNodeId,
    }),
    nativeWorkbenchNodeSchema.parse({
      id: toolsCollectionId,
      stableId: `${project.projectId}:tools`,
      kind: 'collection',
      label: 'Tools',
      parentId: projectNodeId,
    }),
    nativeWorkbenchNodeSchema.parse({
      id: previewsCollectionId,
      stableId: `${project.projectId}:path-previews`,
      kind: 'collection',
      label: 'Path previews',
      parentId: projectNodeId,
      status: operationPreviews.length > 0 ? 'ready' : 'placeholder',
    }),
  ];

  if (sourceNodeId) {
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: sourceNodeId,
      stableId: project.sourceImportId ?? project.projectId,
      kind: 'source',
      label: project.sourceFilename ?? 'Imported source',
      parentId: projectNodeId,
      status: model?.status === 'placeholder' ? 'placeholder' : 'ready',
      metadata: {
        sourceType: project.sourceType ?? 'json',
      },
    }));
  }

  for (const entity of model?.entities ?? []) {
    const nodeId = `node-entity-${sanitizeId(entity.id)}`;
    entityNodeIds.set(entity.id, nodeId);
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: nodeId,
      stableId: entity.stableId,
      kind: 'model_entity',
      label: entity.label,
      parentId: modelCollectionId,
      status: entity.selectable ? 'ready' : 'placeholder',
      entityId: entity.id,
      ...(entity.featureId ? { featureId: entity.featureId } : {}),
      ...(entity.operationId ? { operationId: entity.operationId } : {}),
      metadata: {
        layerId: entity.layerId,
        entityKind: entity.kind,
      },
    }));
  }

  for (const extractedFeature of model?.extractedFeatures ?? []) {
    const nodeId = `node-feature-${sanitizeId(extractedFeature.id)}`;
    featureNodeIds.set(extractedFeature.mappedFeatureId ?? extractedFeature.id, nodeId);
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: nodeId,
      stableId: extractedFeature.mappedFeatureId ?? extractedFeature.id,
      kind: 'feature',
      label: extractedFeature.label,
      parentId: featuresCollectionId,
      status: extractedFeature.warnings.length > 0 ? 'warning' : extractedFeature.classificationState === 'ignored' ? 'placeholder' : 'ready',
      featureId: extractedFeature.mappedFeatureId ?? extractedFeature.id,
      sourceGeometryIds: extractedFeature.sourceGeometryRefs,
      metadata: {
        inferenceMethod: extractedFeature.inferenceMethod,
        kind: extractedFeature.kind,
        classificationState: extractedFeature.classificationState,
      },
    }));
  }

  for (const operation of plan.operations) {
    const nodeId = `node-operation-${sanitizeId(operation.id)}`;
    operationNodeIds.set(operation.id, nodeId);
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: nodeId,
      stableId: operation.id,
      kind: 'operation',
      label: operation.name,
      parentId: operationsCollectionId,
      status: operation.warnings.length > 0 || !operation.enabled ? 'warning' : 'ready',
      operationId: operation.id,
      featureId: operation.featureId,
      toolId: operation.toolId,
      sourceGeometryIds: featureLinksByFeatureId.get(operation.featureId)?.sourceGeometryIds ?? [],
      metadata: {
        kind: operation.kind,
        source: operation.source,
        setupId: operation.setupId,
      },
    }));
  }

  for (const tool of usedTools) {
    const nodeId = `node-tool-${sanitizeId(tool.id)}`;
    toolNodeIds.set(tool.id, nodeId);
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: nodeId,
      stableId: tool.id,
      kind: 'tool',
      label: tool.name,
      parentId: toolsCollectionId,
      toolId: tool.id,
      metadata: {
        diameterMm: tool.diameterMm.toFixed(3),
        type: tool.type,
      },
    }));
  }

  for (const preview of operationPreviews) {
    const nodeId = `node-preview-${sanitizeId(preview.id)}`;
    previewNodeIds.set(preview.operationId, nodeId);
    nodes.push(nativeWorkbenchNodeSchema.parse({
      id: nodeId,
      stableId: preview.id,
      kind: 'operation_preview',
      label: preview.label,
      parentId: previewsCollectionId,
      status: preview.warnings.length > 0 ? 'warning' : 'ready',
      previewId: preview.id,
      operationId: preview.operationId,
      featureId: preview.featureId,
      ...(preview.entityId ? { entityId: preview.entityId } : {}),
      metadata: {
        kind: preview.kind,
        pathPreviewMode: preview.pathPreviewMode,
      },
    }));
  }

  const selectionLinks: NativeWorkbenchSelectionLink[] = plan.operations.map((operation) => {
    const featureLink = featureLinksByFeatureId.get(operation.featureId);
    const preview = previewByOperationId.get(operation.id);
    return nativeWorkbenchSelectionLinkSchema.parse({
      id: `selection-link-${sanitizeId(operation.id)}`,
      syncChannels: ['model_tree', 'features', 'operations', 'tools', 'viewport', 'inspector'],
      ...(featureLink?.entityId ? { modelEntityNodeId: entityNodeIds.get(featureLink.entityId) } : {}),
      ...(featureNodeIds.has(operation.featureId) ? { featureNodeId: featureNodeIds.get(operation.featureId) } : {}),
      ...(operationNodeIds.has(operation.id) ? { operationNodeId: operationNodeIds.get(operation.id) } : {}),
      ...(toolNodeIds.has(operation.toolId) ? { toolNodeId: toolNodeIds.get(operation.toolId) } : {}),
      ...(preview ? { previewNodeId: previewNodeIds.get(operation.id) } : {}),
      sourceGeometryIds: featureLink?.sourceGeometryIds ?? [],
    });
  });

  return nativeWorkbenchSnapshotSchema.parse({
    schemaVersion: 'native-workbench-v1',
    projectId: project.projectId,
    revision: project.revision,
    approvalState: project.approvalState,
    sourceType: project.sourceType,
    sourceImportId: project.sourceImportId,
    importedModelId: project.derivedModel?.id,
    view: project.derivedModel?.view,
    warnings: [...project.warnings, ...(model?.warnings ?? [])],
    nodes,
    selectionLinks,
    metadata: {
      featureCount: plan.features.length,
      extractedFeatureCount: model?.extractedFeatures.length ?? 0,
      operationCount: plan.operations.length,
      toolCount: usedTools.length,
      previewCount: operationPreviews.length,
      hasPlaceholderModel: model?.status === 'placeholder',
    },
  });
}
