import { z } from 'zod';

const coordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type GeometryCoordinate = z.infer<typeof coordinateSchema>;

export const geometryUnitSchema = z.enum(['mm', 'inch', 'unitless']);
export type GeometryUnit = z.infer<typeof geometryUnitSchema>;

export const geometryBoundsSchema = z.object({
  min: coordinateSchema,
  max: coordinateSchema,
  size: coordinateSchema,
  center: coordinateSchema,
});
export type GeometryBounds = z.infer<typeof geometryBoundsSchema>;

export const geometryTransformSchema = z.object({
  translation: coordinateSchema.default({ x: 0, y: 0 }),
  rotationDeg: z.number().default(0),
  scale: z.number().positive().default(1),
});
export type GeometryTransform = z.infer<typeof geometryTransformSchema>;

export const geometrySourceRefSchema = z.object({
  fileType: z.enum(['dxf']),
  handle: z.string().min(1).optional(),
  rawType: z.string().min(1).optional(),
  sequence: z.number().int().nonnegative().optional(),
});
export type GeometrySourceRef = z.infer<typeof geometrySourceRefSchema>;

export const geometryWarningSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning']).default('warning'),
  entityId: z.string().min(1).optional(),
  sourceRef: geometrySourceRefSchema.optional(),
});
export type GeometryWarning = z.infer<typeof geometryWarningSchema>;

export const geometryLayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visible: z.boolean().default(true),
  entityIds: z.array(z.string().min(1)).default([]),
});
export type GeometryLayer = z.infer<typeof geometryLayerSchema>;

const geometryEntityBaseSchema = z.object({
  id: z.string().min(1),
  stableId: z.string().min(1),
  type: z.enum(['line', 'arc', 'circle', 'polyline', 'lwpolyline', 'point', 'text', 'unsupported']),
  layerId: z.string().min(1),
  sourceRef: geometrySourceRefSchema,
  warnings: z.array(z.string()).default([]),
});

const polylineVertexSchema = coordinateSchema.extend({
  bulge: z.number().optional(),
});

const geometryLineEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('line'),
  start: coordinateSchema,
  end: coordinateSchema,
});
const geometryArcEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('arc'),
  center: coordinateSchema,
  radius: z.number().positive(),
  startAngleDeg: z.number(),
  endAngleDeg: z.number(),
});
const geometryCircleEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('circle'),
  center: coordinateSchema,
  radius: z.number().positive(),
});
const geometryPolylineEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('polyline'),
  vertices: z.array(polylineVertexSchema).min(1),
  closed: z.boolean().default(false),
});
const geometryLightweightPolylineEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('lwpolyline'),
  vertices: z.array(polylineVertexSchema).min(1),
  closed: z.boolean().default(false),
});
const geometryPointEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('point'),
  position: coordinateSchema,
});
const geometryTextEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('text'),
  position: coordinateSchema,
  text: z.string(),
  height: z.number().positive().optional(),
});
const geometryUnsupportedEntitySchema = geometryEntityBaseSchema.extend({
  type: z.literal('unsupported'),
  rawType: z.string().min(1),
});

export const geometryEntitySchema = z.discriminatedUnion('type', [
  geometryLineEntitySchema,
  geometryArcEntitySchema,
  geometryCircleEntitySchema,
  geometryPolylineEntitySchema,
  geometryLightweightPolylineEntitySchema,
  geometryPointEntitySchema,
  geometryTextEntitySchema,
  geometryUnsupportedEntitySchema,
]);
export type Geometry2DEntity = z.infer<typeof geometryEntitySchema>;

export const geometryNodeSchema = z.object({
  id: z.string().min(1),
  position: coordinateSchema,
  edgeIds: z.array(z.string().min(1)).default([]),
  entityIds: z.array(z.string().min(1)).default([]),
});
export type GeometryNode = z.infer<typeof geometryNodeSchema>;

export const geometryEdgeSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  kind: z.enum(['line', 'arc', 'circle', 'polyline_segment']),
  startNodeId: z.string().min(1).optional(),
  endNodeId: z.string().min(1).optional(),
  closed: z.boolean().default(false),
  length: z.number().nonnegative(),
});
export type GeometryEdge = z.infer<typeof geometryEdgeSchema>;

export const geometryChainSchema = z.object({
  id: z.string().min(1),
  edgeIds: z.array(z.string().min(1)).default([]),
  entityIds: z.array(z.string().min(1)).default([]),
  nodeIds: z.array(z.string().min(1)).default([]),
  closed: z.boolean().default(false),
  length: z.number().nonnegative(),
  warnings: z.array(z.string()).default([]),
});
export type GeometryChain = z.infer<typeof geometryChainSchema>;

export const geometryLoopSchema = z.object({
  id: z.string().min(1),
  chainIds: z.array(z.string().min(1)).default([]),
  edgeIds: z.array(z.string().min(1)).default([]),
  entityIds: z.array(z.string().min(1)).default([]),
  bounds: geometryBoundsSchema,
  area: z.number(),
  clockwise: z.boolean(),
});
export type GeometryLoop = z.infer<typeof geometryLoopSchema>;

export const geometryProfileSchema = z.object({
  id: z.string().min(1),
  loopId: z.string().min(1).optional(),
  chainId: z.string().min(1).optional(),
  entityIds: z.array(z.string().min(1)).default([]),
  closed: z.boolean().default(false),
  bounds: geometryBoundsSchema,
  area: z.number().nonnegative().default(0),
});
export type GeometryProfile = z.infer<typeof geometryProfileSchema>;

export const geometryRegionSchema = z.object({
  id: z.string().min(1),
  outerLoopId: z.string().min(1),
  innerLoopIds: z.array(z.string().min(1)).default([]),
  entityIds: z.array(z.string().min(1)).default([]),
  bounds: geometryBoundsSchema,
  area: z.number().nonnegative(),
  depth: z.number().nonnegative().default(0),
});
export type GeometryRegion = z.infer<typeof geometryRegionSchema>;

export const geometryGraphSchema = z.object({
  tolerance: z.number().positive(),
  nodes: z.array(geometryNodeSchema),
  edges: z.array(geometryEdgeSchema),
  chains: z.array(geometryChainSchema),
  loops: z.array(geometryLoopSchema),
  profiles: z.array(geometryProfileSchema),
  regions: z.array(geometryRegionSchema),
  openProfileIds: z.array(z.string().min(1)).default([]),
  closedProfileIds: z.array(z.string().min(1)).default([]),
});
export type GeometryGraph = z.infer<typeof geometryGraphSchema>;

export const geometry2DDocumentSchema = z.object({
  id: z.string().min(1),
  units: geometryUnitSchema,
  source: z.enum(['dxf']).default('dxf'),
  bounds: geometryBoundsSchema,
  transform: geometryTransformSchema,
  layers: z.array(geometryLayerSchema),
  entities: z.array(geometryEntitySchema),
  warnings: z.array(geometryWarningSchema).default([]),
});
export type Geometry2DDocument = z.infer<typeof geometry2DDocumentSchema>;

const entitySequencePadding = 4;
const defaultTolerance = 0.05;

type DxfGroup = { code: number; value: string };

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function coordinate(x = 0, y = 0): GeometryCoordinate {
  return { x, y };
}

function boundsFromCoordinates(points: GeometryCoordinate[]): GeometryBounds {
  if (points.length === 0) {
    return { min: coordinate(), max: coordinate(), size: coordinate(), center: coordinate() };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const min = coordinate(Math.min(...xs), Math.min(...ys));
  const max = coordinate(Math.max(...xs), Math.max(...ys));
  const size = coordinate(max.x - min.x, max.y - min.y);
  const center = coordinate(min.x + size.x / 2, min.y + size.y / 2);
  return { min, max, size, center };
}

function distance(start: GeometryCoordinate, end: GeometryCoordinate): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeAngleDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function arcSweepDegrees(startAngleDeg: number, endAngleDeg: number): number {
  const start = normalizeAngleDegrees(startAngleDeg);
  const end = normalizeAngleDegrees(endAngleDeg);
  return end >= start ? end - start : 360 - start + end;
}

function sampleArcPoints(
  center: GeometryCoordinate,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  segmentHint = 24,
): GeometryCoordinate[] {
  const sweep = Math.max(arcSweepDegrees(startAngleDeg, endAngleDeg), 1);
  const segments = Math.max(2, Math.ceil((sweep / 360) * segmentHint));
  const points: GeometryCoordinate[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngleDeg + (sweep * index) / segments;
    const radians = toRadians(angle);
    points.push(coordinate(center.x + radius * Math.cos(radians), center.y + radius * Math.sin(radians)));
  }
  return points;
}

export function sampleEntityPoints(entity: Geometry2DEntity): GeometryCoordinate[] {
  switch (entity.type) {
    case 'line':
      return [entity.start, entity.end];
    case 'arc':
      return sampleArcPoints(entity.center, entity.radius, entity.startAngleDeg, entity.endAngleDeg);
    case 'circle':
      return sampleArcPoints(entity.center, entity.radius, 0, 360, 36);
    case 'polyline':
    case 'lwpolyline': {
      const vertices = entity.vertices.map((vertex) => coordinate(vertex.x, vertex.y));
      if (entity.closed && vertices.length > 0) {
        return [...vertices, vertices[0]!];
      }
      return vertices;
    }
    case 'point':
      return [entity.position];
    case 'text':
      return [entity.position];
    case 'unsupported':
      return [];
  }
}

export function entityBounds(entity: Geometry2DEntity): GeometryBounds {
  return boundsFromCoordinates(sampleEntityPoints(entity));
}

function headerUnits(groups: DxfGroup[]): GeometryUnit | null {
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group?.code === 9 && group.value === '$INSUNITS') {
      const unitCode = Number(groups[index + 1]?.value ?? '0');
      if (unitCode === 4) {
        return 'mm';
      }
      if (unitCode === 1) {
        return 'inch';
      }
      return 'unitless';
    }
  }
  return null;
}

function parseGroups(content: string): DxfGroup[] {
  const lines = content.replace(/\r/g, '').split('\n');
  const groups: DxfGroup[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const codeLine = lines[index]?.trim();
    const valueLine = lines[index + 1] ?? '';
    if (!codeLine) {
      continue;
    }
    const code = Number(codeLine);
    if (Number.isNaN(code)) {
      continue;
    }
    groups.push({ code, value: valueLine.trimEnd() });
  }
  return groups;
}

function splitSections(groups: DxfGroup[]): Map<string, DxfGroup[]> {
  const sections = new Map<string, DxfGroup[]>();
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group?.code === 0 && group.value === 'SECTION') {
      const sectionName = groups[index + 1]?.code === 2 ? groups[index + 1]?.value : undefined;
      if (!sectionName) {
        continue;
      }
      const sectionGroups: DxfGroup[] = [];
      index += 2;
      while (index < groups.length) {
        const candidate = groups[index];
        if (candidate?.code === 0 && candidate.value === 'ENDSEC') {
          break;
        }
        if (candidate) {
          sectionGroups.push(candidate);
        }
        index += 1;
      }
      sections.set(sectionName, sectionGroups);
    }
  }
  return sections;
}

function parseCommonEntityData(groups: DxfGroup[], fallbackLayer = '0') {
  return {
    handle: groups.find((group) => group.code === 5)?.value,
    layerName: groups.find((group) => group.code === 8)?.value ?? fallbackLayer,
  };
}

function numericValue(groups: DxfGroup[], code: number, fallback = 0): number {
  const value = Number(groups.find((group) => group.code === code)?.value ?? `${fallback}`);
  return Number.isFinite(value) ? value : fallback;
}

function textValue(groups: DxfGroup[], code: number): string | undefined {
  return groups.find((group) => group.code === code)?.value;
}

function chunkEntityGroups(groups: DxfGroup[]): Array<{ type: string; groups: DxfGroup[] }> {
  const entities: Array<{ type: string; groups: DxfGroup[] }> = [];
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (!group || group.code !== 0) {
      continue;
    }

    if (group.value === 'POLYLINE') {
      const polylineGroups: DxfGroup[] = [];
      index += 1;
      while (index < groups.length) {
        const current = groups[index];
        if (!current) {
          index += 1;
          continue;
        }
        polylineGroups.push(current);
        if (current.code === 0 && current.value === 'SEQEND') {
          break;
        }
        index += 1;
      }
      entities.push({ type: 'POLYLINE', groups: polylineGroups });
      continue;
    }

    const entityGroups: DxfGroup[] = [];
    index += 1;
    while (index < groups.length) {
      const current = groups[index];
      if (current?.code === 0) {
        index -= 1;
        break;
      }
      if (current) {
        entityGroups.push(current);
      }
      index += 1;
    }
    entities.push({ type: group.value, groups: entityGroups });
  }
  return entities;
}

function layerId(name: string): string {
  return `layer-${sanitizeId(name)}`;
}

function createEntityId(type: string, index: number): string {
  return `geom-${sanitizeId(type)}-${String(index + 1).padStart(entitySequencePadding, '0')}`;
}

export function parseDxfGeometry2D(content: string, documentId = 'geometry-dxf'): Geometry2DDocument {
  const groups = parseGroups(content);
  const sections = splitSections(groups);
  const warnings: GeometryWarning[] = [];
  const units = headerUnits(sections.get('HEADER') ?? []) ?? 'unitless';
  if (units === 'unitless') {
    warnings.push({
      id: 'warning-units-unitless',
      code: 'units_unitless',
      message: 'DXF units were not explicitly set to millimeters or inches. Geometry is imported as unitless source data.',
      severity: 'warning',
    });
  }

  const entities: Geometry2DEntity[] = [];
  const layers = new Map<string, GeometryLayer>();
  const entityChunks = chunkEntityGroups(sections.get('ENTITIES') ?? []);

  const registerLayer = (name: string, entityId: string) => {
    const id = layerId(name);
    const existing = layers.get(id) ?? { id, name, visible: true, entityIds: [] };
    existing.entityIds = [...existing.entityIds, entityId];
    layers.set(id, existing);
    return id;
  };

  const registerUnsupported = (type: string, entityId: string, sourceRef: GeometrySourceRef) => {
    warnings.push({
      id: `warning-${entityId}`,
      code: 'unsupported_entity',
      message: `${type} entities are not interpreted in the current DXF subset. The record is preserved as an unsupported placeholder.`,
      severity: 'warning',
      entityId,
      sourceRef,
    });
  };

  entityChunks.forEach((chunk, index) => {
    const id = createEntityId(chunk.type, index);
    const common = parseCommonEntityData(chunk.groups);
    const sourceRef: GeometrySourceRef = {
      fileType: 'dxf',
      handle: common.handle,
      rawType: chunk.type,
      sequence: index,
    };
    const assignedLayerId = registerLayer(common.layerName, id);

    switch (chunk.type) {
      case 'LINE':
        entities.push({
          id,
          stableId: id,
          type: 'line',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [],
          start: coordinate(numericValue(chunk.groups, 10), numericValue(chunk.groups, 20)),
          end: coordinate(numericValue(chunk.groups, 11), numericValue(chunk.groups, 21)),
        });
        break;
      case 'ARC':
        entities.push({
          id,
          stableId: id,
          type: 'arc',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [],
          center: coordinate(numericValue(chunk.groups, 10), numericValue(chunk.groups, 20)),
          radius: Math.max(numericValue(chunk.groups, 40), Number.EPSILON),
          startAngleDeg: numericValue(chunk.groups, 50),
          endAngleDeg: numericValue(chunk.groups, 51),
        });
        break;
      case 'CIRCLE':
        entities.push({
          id,
          stableId: id,
          type: 'circle',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [],
          center: coordinate(numericValue(chunk.groups, 10), numericValue(chunk.groups, 20)),
          radius: Math.max(numericValue(chunk.groups, 40), Number.EPSILON),
        });
        break;
      case 'POINT':
        entities.push({
          id,
          stableId: id,
          type: 'point',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [],
          position: coordinate(numericValue(chunk.groups, 10), numericValue(chunk.groups, 20)),
        });
        break;
      case 'TEXT':
      case 'MTEXT':
        entities.push({
          id,
          stableId: id,
          type: 'text',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [],
          position: coordinate(numericValue(chunk.groups, 10), numericValue(chunk.groups, 20)),
          text: [textValue(chunk.groups, 1), textValue(chunk.groups, 3)].filter(Boolean).join(' ').trim(),
          height: numericValue(chunk.groups, 40, 1) || undefined,
        });
        break;
      case 'LWPOLYLINE': {
        const vertices: Array<{ x: number; y: number; bulge?: number }> = [];
        let currentVertex: { x?: number; y?: number; bulge?: number } = {};
        for (const group of chunk.groups) {
          if (group.code === 10) {
            if (typeof currentVertex.x === 'number' && typeof currentVertex.y === 'number') {
              vertices.push({ x: currentVertex.x, y: currentVertex.y, ...(typeof currentVertex.bulge === 'number' ? { bulge: currentVertex.bulge } : {}) });
            }
            currentVertex = { x: Number(group.value) };
          } else if (group.code === 20) {
            currentVertex.y = Number(group.value);
          } else if (group.code === 42) {
            currentVertex.bulge = Number(group.value);
          }
        }
        if (typeof currentVertex.x === 'number' && typeof currentVertex.y === 'number') {
          vertices.push({ x: currentVertex.x, y: currentVertex.y, ...(typeof currentVertex.bulge === 'number' ? { bulge: currentVertex.bulge } : {}) });
        }
        const closed = (Math.round(numericValue(chunk.groups, 70)) & 1) === 1;
        const bulged = vertices.some((vertex) => typeof vertex.bulge === 'number' && Math.abs(vertex.bulge) > Number.EPSILON);
        const entityWarnings = bulged ? ['Polyline bulge values are preserved as metadata but approximated as straight segments in the current graph builder.'] : [];
        if (bulged) {
          warnings.push({
            id: `warning-bulge-${id}`,
            code: 'polyline_bulge_approximated',
            message: entityWarnings[0]!,
            severity: 'warning',
            entityId: id,
            sourceRef,
          });
        }
        entities.push({
          id,
          stableId: id,
          type: 'lwpolyline',
          layerId: assignedLayerId,
          sourceRef,
          warnings: entityWarnings,
          vertices,
          closed,
        });
        break;
      }
      case 'POLYLINE': {
        const headerClosed = (Math.round(numericValue(chunk.groups, 70)) & 1) === 1;
        const vertices: Array<{ x: number; y: number; bulge?: number }> = [];
        let vertexGroups: DxfGroup[] = [];
        for (const group of chunk.groups) {
          if (group.code === 0 && group.value === 'VERTEX') {
            vertexGroups = [];
            continue;
          }
          if (group.code === 0 && group.value === 'SEQEND') {
            if (vertexGroups.length > 0) {
              vertices.push({
                x: numericValue(vertexGroups, 10),
                y: numericValue(vertexGroups, 20),
                ...(vertexGroups.some((candidate) => candidate.code === 42)
                  ? { bulge: numericValue(vertexGroups, 42) }
                  : {}),
              });
              vertexGroups = [];
            }
            continue;
          }
          if (group.code === 0) {
            if (vertexGroups.length > 0) {
              vertices.push({
                x: numericValue(vertexGroups, 10),
                y: numericValue(vertexGroups, 20),
                ...(vertexGroups.some((candidate) => candidate.code === 42)
                  ? { bulge: numericValue(vertexGroups, 42) }
                  : {}),
              });
              vertexGroups = [];
            }
            continue;
          }
          vertexGroups.push(group);
        }
        if (vertexGroups.length > 0) {
          vertices.push({ x: numericValue(vertexGroups, 10), y: numericValue(vertexGroups, 20) });
        }
        const bulged = vertices.some((vertex) => typeof vertex.bulge === 'number' && Math.abs(vertex.bulge) > Number.EPSILON);
        const entityWarnings = bulged ? ['Polyline bulge values are preserved as metadata but approximated as straight segments in the current graph builder.'] : [];
        if (bulged) {
          warnings.push({
            id: `warning-bulge-${id}`,
            code: 'polyline_bulge_approximated',
            message: entityWarnings[0]!,
            severity: 'warning',
            entityId: id,
            sourceRef,
          });
        }
        entities.push({
          id,
          stableId: id,
          type: 'polyline',
          layerId: assignedLayerId,
          sourceRef,
          warnings: entityWarnings,
          vertices,
          closed: headerClosed,
        });
        break;
      }
      default:
        registerUnsupported(chunk.type, id, sourceRef);
        entities.push({
          id,
          stableId: id,
          type: 'unsupported',
          layerId: assignedLayerId,
          sourceRef,
          warnings: [`${chunk.type} is outside the current DXF subset.`],
          rawType: chunk.type,
        });
        break;
    }
  });

  const bounds = boundsFromCoordinates(entities.flatMap((entity) => sampleEntityPoints(entity)));
  return geometry2DDocumentSchema.parse({
    id: documentId,
    units,
    source: 'dxf',
    bounds,
    transform: { translation: coordinate(), rotationDeg: 0, scale: 1 },
    layers: [...layers.values()].sort((left, right) => left.name.localeCompare(right.name)),
    entities,
    warnings,
  });
}

function nodeKey(point: GeometryCoordinate, tolerance: number): string {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

function polygonArea(points: GeometryCoordinate[]): number {
  if (points.length < 3) {
    return 0;
  }
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function polygonCentroid(points: GeometryCoordinate[]): GeometryCoordinate {
  if (points.length === 0) {
    return coordinate();
  }
  const area = polygonArea(points);
  if (Math.abs(area) < Number.EPSILON) {
    return boundsFromCoordinates(points).center;
  }
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const factor = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }
  return coordinate(x / (6 * area), y / (6 * area));
}

function pointInPolygon(point: GeometryCoordinate, polygon: GeometryCoordinate[]): boolean {
  let inside = false;
  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex, currentIndex += 1) {
    const current = polygon[currentIndex]!;
    const previous = polygon[previousIndex]!;
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || Number.EPSILON) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function chainPointPath(chain: GeometryChain, nodesById: Map<string, GeometryNode>): GeometryCoordinate[] {
  return chain.nodeIds.map((nodeId) => nodesById.get(nodeId)?.position).filter((point): point is GeometryCoordinate => Boolean(point));
}

function edgeLength(entity: Geometry2DEntity): number {
  switch (entity.type) {
    case 'line':
      return distance(entity.start, entity.end);
    case 'arc':
      return (Math.PI * entity.radius * arcSweepDegrees(entity.startAngleDeg, entity.endAngleDeg)) / 180;
    case 'circle':
      return 2 * Math.PI * entity.radius;
    case 'polyline':
    case 'lwpolyline': {
      const pairs = entity.vertices.slice(1).map((vertex, index) => [entity.vertices[index]!, vertex] as const);
      const openLength = pairs.reduce((sum, [start, end]) => sum + distance(start, end), 0);
      if (entity.closed && entity.vertices.length > 1) {
        return openLength + distance(entity.vertices[entity.vertices.length - 1]!, entity.vertices[0]!);
      }
      return openLength;
    }
    default:
      return 0;
  }
}

export function buildGeometryGraph(document: Geometry2DDocument, tolerance = defaultTolerance): GeometryGraph {
  const nodes: GeometryNode[] = [];
  const nodesByKey = new Map<string, GeometryNode>();
  const edges: GeometryEdge[] = [];
  const nodeLookup = (point: GeometryCoordinate, entityId: string): GeometryNode => {
    const key = nodeKey(point, tolerance);
    const existing = nodesByKey.get(key);
    if (existing) {
      existing.entityIds = [...new Set([...existing.entityIds, entityId])];
      return existing;
    }
    const nextNode = geometryNodeSchema.parse({
      id: `node-${nodes.length + 1}`,
      position: coordinate(point.x, point.y),
      edgeIds: [],
      entityIds: [entityId],
    });
    nodes.push(nextNode);
    nodesByKey.set(key, nextNode);
    return nextNode;
  };

  for (const entity of document.entities) {
    if (entity.type === 'unsupported' || entity.type === 'point' || entity.type === 'text') {
      continue;
    }

    if (entity.type === 'circle') {
      const edgeId = `edge-${entity.id}`;
      edges.push({ id: edgeId, entityId: entity.id, kind: 'circle', closed: true, length: edgeLength(entity) });
      continue;
    }

    if (entity.type === 'line') {
      const startNode = nodeLookup(entity.start, entity.id);
      const endNode = nodeLookup(entity.end, entity.id);
      const edgeId = `edge-${entity.id}`;
      startNode.edgeIds = [...new Set([...startNode.edgeIds, edgeId])];
      endNode.edgeIds = [...new Set([...endNode.edgeIds, edgeId])];
      edges.push({ id: edgeId, entityId: entity.id, kind: 'line', startNodeId: startNode.id, endNodeId: endNode.id, closed: false, length: edgeLength(entity) });
      continue;
    }

    if (entity.type === 'arc') {
      const points = sampleEntityPoints(entity);
      const startNode = nodeLookup(points[0] ?? coordinate(), entity.id);
      const endNode = nodeLookup(points[points.length - 1] ?? coordinate(), entity.id);
      const edgeId = `edge-${entity.id}`;
      startNode.edgeIds = [...new Set([...startNode.edgeIds, edgeId])];
      endNode.edgeIds = [...new Set([...endNode.edgeIds, edgeId])];
      edges.push({ id: edgeId, entityId: entity.id, kind: 'arc', startNodeId: startNode.id, endNodeId: endNode.id, closed: false, length: edgeLength(entity) });
      continue;
    }

    if (entity.type === 'polyline' || entity.type === 'lwpolyline') {
      const vertices = entity.vertices.map((vertex) => coordinate(vertex.x, vertex.y));
      const pairs = vertices.slice(1).map((vertex, index) => [vertices[index]!, vertex] as const);
      if (entity.closed && vertices.length > 1) {
        pairs.push([vertices[vertices.length - 1]!, vertices[0]!]);
      }
      pairs.forEach(([start, end], segmentIndex) => {
        const startNode = nodeLookup(start, entity.id);
        const endNode = nodeLookup(end, entity.id);
        const edgeId = `edge-${entity.id}-${segmentIndex + 1}`;
        startNode.edgeIds = [...new Set([...startNode.edgeIds, edgeId])];
        endNode.edgeIds = [...new Set([...endNode.edgeIds, edgeId])];
        edges.push({
          id: edgeId,
          entityId: entity.id,
          kind: 'polyline_segment',
          startNodeId: startNode.id,
          endNodeId: endNode.id,
          closed: false,
          length: distance(start, end),
        });
      });
    }
  }

  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, node.edgeIds);
  }

  const visited = new Set<string>();
  const chains: GeometryChain[] = [];
  const linearEdges = edges.filter((edge) => !edge.closed && edge.startNodeId && edge.endNodeId);

  const traverseChain = (startEdge: GeometryEdge, startNodeId?: string): GeometryChain => {
    const edgeIds: string[] = [];
    const entityIds = new Set<string>();
    const nodeIds: string[] = [];
    let closed = false;
    let length = 0;
    let currentEdge: GeometryEdge | undefined = startEdge;
    let currentNodeId = startNodeId ?? currentEdge.startNodeId;
    while (currentEdge && !visited.has(currentEdge.id)) {
      visited.add(currentEdge.id);
      edgeIds.push(currentEdge.id);
      entityIds.add(currentEdge.entityId);
      length += currentEdge.length;
      if (currentNodeId) {
        nodeIds.push(currentNodeId);
      }
      const nextNodeId: string | undefined =
        currentEdge.startNodeId === currentNodeId ? currentEdge.endNodeId : currentEdge.startNodeId;
      if (!nextNodeId) {
        break;
      }
      if (nextNodeId === nodeIds[0] && edgeIds.length > 1) {
        nodeIds.push(nextNodeId);
        closed = true;
        break;
      }
      const candidateEdges: GeometryEdge[] = [];
      for (const edgeId of adjacency.get(nextNodeId) ?? []) {
        const edge = edgesById.get(edgeId);
        if (edge && !visited.has(edge.id)) {
          candidateEdges.push(edge);
        }
      }
      currentNodeId = nextNodeId;
      if (candidateEdges.length !== 1) {
        nodeIds.push(nextNodeId);
        break;
      }
      currentEdge = candidateEdges[0];
    }

    return geometryChainSchema.parse({
      id: `chain-${chains.length + 1}`,
      edgeIds,
      entityIds: [...entityIds],
      nodeIds: [...new Set(nodeIds)],
      closed,
      length,
      warnings: closed ? [] : ['Open chain detected. This profile cannot be promoted to a closed machining region automatically.'],
    });
  };

  const preferredStarts = linearEdges.filter((edge) => {
    const startDegree = edge.startNodeId ? (adjacency.get(edge.startNodeId)?.length ?? 0) : 0;
    const endDegree = edge.endNodeId ? (adjacency.get(edge.endNodeId)?.length ?? 0) : 0;
    return startDegree !== 2 || endDegree !== 2;
  });

  for (const edge of preferredStarts) {
    if (!visited.has(edge.id)) {
      const startNodeId = edge.startNodeId && (adjacency.get(edge.startNodeId)?.length ?? 0) !== 2 ? edge.startNodeId : edge.endNodeId;
      chains.push(traverseChain(edge, startNodeId));
    }
  }
  for (const edge of linearEdges) {
    if (!visited.has(edge.id)) {
      chains.push(traverseChain(edge, edge.startNodeId));
    }
  }

  const loops: GeometryLoop[] = [];
  const profiles: GeometryProfile[] = [];
  const loopPolygons = new Map<string, GeometryCoordinate[]>();

  for (const chain of chains) {
    const points = chainPointPath(chain, nodeById);
    const bounds = boundsFromCoordinates(points);
    const area = Math.abs(polygonArea(points));
    const profileId = `profile-${profiles.length + 1}`;
    profiles.push({ id: profileId, chainId: chain.id, entityIds: chain.entityIds, closed: chain.closed, bounds, area });
    if (chain.closed && points.length >= 3) {
      const signedArea = polygonArea(points);
      const loopId = `loop-${loops.length + 1}`;
      const polygon = points.length > 0 && points[0] !== points[points.length - 1] ? [...points, points[0]!] : points;
      loopPolygons.set(loopId, polygon);
      loops.push({
        id: loopId,
        chainIds: [chain.id],
        edgeIds: chain.edgeIds,
        entityIds: chain.entityIds,
        bounds,
        area,
        clockwise: signedArea < 0,
      });
      profiles[profiles.length - 1] = { ...profiles[profiles.length - 1]!, loopId };
    }
  }

  const circleEntities = document.entities.filter((entity): entity is Extract<Geometry2DEntity, { type: 'circle' }> => entity.type === 'circle');
  circleEntities.forEach((entity) => {
    const loopId = `loop-${loops.length + 1}`;
    const polygon = sampleEntityPoints(entity);
    loopPolygons.set(loopId, polygon);
    loops.push({
      id: loopId,
      chainIds: [],
      edgeIds: [`edge-${entity.id}`],
      entityIds: [entity.id],
      bounds: entityBounds(entity),
      area: Math.PI * entity.radius * entity.radius,
      clockwise: false,
    });
    profiles.push({
      id: `profile-${profiles.length + 1}`,
      loopId,
      entityIds: [entity.id],
      closed: true,
      bounds: entityBounds(entity),
      area: Math.PI * entity.radius * entity.radius,
    });
  });

  const regions: GeometryRegion[] = loops
    .sort((left, right) => right.area - left.area)
    .map((loop, loopIndex, sortedLoops) => {
      const loopPolygon = loopPolygons.get(loop.id) ?? [];
      const centroid = polygonCentroid(loopPolygon);
      const parent = sortedLoops.find((candidate) => {
        if (candidate.id === loop.id || candidate.area <= loop.area) {
          return false;
        }
        return pointInPolygon(centroid, loopPolygons.get(candidate.id) ?? []);
      });
      const innerLoopIds = sortedLoops
        .filter((candidate) => candidate.id !== loop.id && candidate.area < loop.area)
        .filter((candidate) => pointInPolygon(polygonCentroid(loopPolygons.get(candidate.id) ?? []), loopPolygon))
        .map((candidate) => candidate.id);
      return {
        id: `region-${loopIndex + 1}`,
        outerLoopId: loop.id,
        innerLoopIds: parent ? [] : innerLoopIds,
        entityIds: loop.entityIds,
        bounds: loop.bounds,
        area: loop.area,
        depth: 0,
      };
    });

  return geometryGraphSchema.parse({
    tolerance,
    nodes,
    edges,
    chains,
    loops,
    profiles,
    regions,
    openProfileIds: profiles.filter((profile) => !profile.closed).map((profile) => profile.id),
    closedProfileIds: profiles.filter((profile) => profile.closed).map((profile) => profile.id),
  });
}
