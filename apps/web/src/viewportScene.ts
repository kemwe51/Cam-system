import type { DraftCamPlan, NormalizedFeature, Operation, PartInput } from '@cam/shared';

export type ViewOrientation = 'isometric' | 'top' | 'front' | 'right' | 'fit';
export type ViewMode = 'shaded' | 'wireframe' | 'stock_only' | 'features' | 'operations';

export type DerivedBody = {
  featureId: string;
  kind: NormalizedFeature['kind'];
  label: string;
  text: string;
  position: [number, number, number];
  size: [number, number, number];
  quantity: number;
  color: string;
};

export type SelectionOverlay = {
  featureId: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

export type OperationOverlay = {
  operationId: string;
  featureId: string;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  enabled: boolean;
  origin: Operation['origin'];
};

export type ScenePipeline = {
  stockBody: {
    size: [number, number, number];
  };
  featureBodies: DerivedBody[];
  selectionOverlay: SelectionOverlay | null;
  operationOverlays: OperationOverlay[];
  section: {
    clippingPlanes: [];
    readyForSectionPlanes: true;
  };
  disclaimer: string;
};

export const derivedViewportDisclaimer =
  'Derived viewport only: stock, features, and operation overlays are arranged from structured JSON and draft state. This is not a CAD kernel, STEP/DXF machining pipeline, or verified toolpath preview.';

const featureColors: Record<NormalizedFeature['kind'], string> = {
  top_surface: '#38bdf8',
  contour: '#22c55e',
  pocket: '#a855f7',
  slot: '#f59e0b',
  hole_group: '#e879f9',
  chamfer: '#fb7185',
  engraving: '#f97316',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseFeatureText(feature: NormalizedFeature): string {
  const explicitText = feature.notes.find((note) => note.startsWith('Text: '));
  return explicitText ? explicitText.replace('Text: ', '') : feature.name;
}

function contourFootprint(part: PartInput, feature: NormalizedFeature): [number, number, number] {
  const ratio = part.stock.xMm / part.stock.yMm;
  const perimeter = Math.max(feature.lengthMm, 1);
  const width = clamp(perimeter / (2 * (ratio + 1)), part.stock.yMm * 0.35, part.stock.yMm * 0.92);
  const length = clamp(perimeter / 2 - width, part.stock.xMm * 0.35, part.stock.xMm * 0.92);
  return [length, width, Math.max(feature.depthMm, 0.6)];
}

function featureFootprint(part: PartInput, feature: NormalizedFeature): [number, number, number] {
  switch (feature.kind) {
    case 'top_surface': {
      const side = clamp(Math.sqrt(Math.max(feature.areaMm2, 1)), part.stock.yMm * 0.35, part.stock.xMm * 0.96);
      return [clamp(side * 1.15, part.stock.xMm * 0.4, part.stock.xMm * 0.96), side, 0.8];
    }
    case 'contour':
      return contourFootprint(part, feature);
    case 'pocket':
      return [
        clamp(feature.lengthMm, part.stock.xMm * 0.18, part.stock.xMm * 0.72),
        clamp(feature.widthMm, part.stock.yMm * 0.14, part.stock.yMm * 0.68),
        clamp(feature.depthMm, 1, part.stock.zMm * 0.8),
      ];
    case 'slot':
      return [
        clamp(feature.lengthMm, part.stock.xMm * 0.2, part.stock.xMm * 0.8),
        clamp(feature.widthMm, 3, part.stock.yMm * 0.3),
        clamp(feature.depthMm, 1, part.stock.zMm * 0.5),
      ];
    case 'hole_group': {
      const diameter = clamp(feature.lengthMm, 3, part.stock.xMm * 0.22);
      return [diameter * Math.max(Math.ceil(feature.quantity / 2), 1), diameter * 2, clamp(feature.depthMm, 1, part.stock.zMm * 0.75)];
    }
    case 'chamfer':
      return [
        clamp(feature.lengthMm / 4, part.stock.xMm * 0.3, part.stock.xMm * 0.96),
        clamp(feature.widthMm * 5, 3, part.stock.yMm * 0.16),
        clamp(feature.depthMm, 0.4, part.stock.zMm * 0.14),
      ];
    case 'engraving':
      return [
        clamp(feature.lengthMm, part.stock.xMm * 0.2, part.stock.xMm * 0.75),
        clamp(feature.widthMm * 10, 3, part.stock.yMm * 0.1),
        clamp(feature.depthMm, 0.2, part.stock.zMm * 0.08),
      ];
    default:
      return [part.stock.xMm * 0.25, part.stock.yMm * 0.25, 1];
  }
}

function layoutFeatureBodies(part: PartInput, features: NormalizedFeature[]): DerivedBody[] {
  const columns = Math.max(Math.ceil(Math.sqrt(features.length || 1)), 1);
  const rows = Math.max(Math.ceil((features.length || 1) / columns), 1);
  const laneWidth = part.stock.xMm / columns;
  const laneHeight = part.stock.yMm / rows;
  const topZ = part.stock.zMm / 2;

  return features.map((feature, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const footprint = featureFootprint(part, feature);
    const x = -part.stock.xMm / 2 + laneWidth * column + laneWidth / 2;
    const y = part.stock.yMm / 2 - laneHeight * row - laneHeight / 2;
    const depthOffset = feature.kind === 'contour' ? 0.8 : footprint[2] / 2;

    return {
      featureId: feature.id,
      kind: feature.kind,
      label: feature.name,
      text: parseFeatureText(feature),
      position: [x, y, topZ - depthOffset],
      size: footprint,
      quantity: feature.quantity,
      color: featureColors[feature.kind] ?? '#94a3b8',
    };
  });
}

function getOperationOverlayColor(operation: Operation, selectedOperationId: string | null): string {
  if (selectedOperationId === operation.id) {
    return '#f8fafc';
  }

  if (!operation.enabled) {
    return '#ef4444';
  }

  return operation.origin === 'manual' ? '#f59e0b' : '#38bdf8';
}

function buildOperationOverlays(
  featureBodies: DerivedBody[],
  operations: DraftCamPlan['operations'],
  selectedOperationId: string | null,
): OperationOverlay[] {
  const bodyMap = new Map(featureBodies.map((body) => [body.featureId, body]));

  return operations.map((operation, index) => {
    const body = bodyMap.get(operation.featureId);
    const size = body?.size ?? [12, 12, 1.5];
    const position = body?.position ?? [0, 0, 0];
    const lift = size[2] / 2 + 1.5 + index * 0.08;
    return {
      operationId: operation.id,
      featureId: operation.featureId,
      label: operation.name,
      position: [position[0], position[1], position[2] + lift],
      size: [Math.max(size[0] * 0.88, 4), Math.max(size[1] * 0.88, 4), 0.6],
      color: getOperationOverlayColor(operation, selectedOperationId),
      enabled: operation.enabled,
      origin: operation.origin,
    };
  });
}

export function buildScenePipeline(
  part: PartInput,
  features: NormalizedFeature[],
  operations: DraftCamPlan['operations'],
  selectedFeatureId: string | null,
  selectedOperationId: string | null,
): ScenePipeline {
  const featureBodies = layoutFeatureBodies(part, features);
  const selectedBody = featureBodies.find((entity) => entity.featureId === selectedFeatureId) ?? null;

  return {
    stockBody: {
      size: [part.stock.xMm, part.stock.yMm, part.stock.zMm],
    },
    featureBodies,
    selectionOverlay: selectedBody
      ? {
          featureId: selectedBody.featureId,
          position: selectedBody.position,
          size: [selectedBody.size[0] + 2.5, selectedBody.size[1] + 2.5, selectedBody.size[2] + 1.5],
          color: '#f8fafc',
        }
      : null,
    operationOverlays: buildOperationOverlays(featureBodies, operations, selectedOperationId),
    section: {
      clippingPlanes: [],
      readyForSectionPlanes: true,
    },
    disclaimer: derivedViewportDisclaimer,
  };
}
