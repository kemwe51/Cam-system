import {
  deriveOperationPreviews,
  type DerivedGeometryFragment,
  type ImportedModel,
  type ModelEntity,
  type OperationPreview,
  type ViewMode,
} from '@cam/model';
import type { DraftCamPlan } from '@cam/shared';

export type ViewOrientation = 'isometric' | 'top' | 'front' | 'right' | 'fit';

export type ScenePipeline = {
  stockEntity: ModelEntity | null;
  sourceModelLayer: {
    entities: ModelEntity[];
  };
  featureLayer: {
    entities: ModelEntity[];
  };
  selectionLayer: {
    entity: ModelEntity | null;
  };
  operationPreviewLayer: {
    previews: OperationPreview[];
  };
  fragments: Map<string, DerivedGeometryFragment>;
  stockSize: [number, number, number];
  disclaimer: string;
};

export const derivedViewportDisclaimer =
  'Derived viewport only: source/model layers, stock, feature envelopes, and operation preview overlays are arranged from import metadata and deterministic plan state. This is not a CAD kernel, STEP/DXF machining pipeline, or verified toolpath preview.';

export function buildOperationPreviewLayer(model: ImportedModel | null, operations: DraftCamPlan['operations']): OperationPreview[] {
  if (!model) {
    return [];
  }
  return deriveOperationPreviews(model, operations);
}

export function buildScenePipeline(
  model: ImportedModel,
  operationPreviews: OperationPreview[],
  selectedFeatureId: string | null,
  selectedOperationId: string | null,
): ScenePipeline {
  const fragments = new Map(model.fragments.map((fragment) => [fragment.id, fragment]));
  const stockEntity = model.entities.find((entity) => entity.kind === 'stock') ?? null;
  const featureEntities = model.entities.filter((entity) => entity.kind === 'feature');
  const selectionEntity = featureEntities.find((entity) => entity.featureId === selectedFeatureId)
    ?? model.entities.find((entity) => entity.operationId === selectedOperationId)
    ?? null;

  return {
    stockEntity,
    sourceModelLayer: {
      entities: model.entities.filter((entity) => entity.kind === 'source_geometry' || entity.kind === 'stock'),
    },
    featureLayer: {
      entities: featureEntities,
    },
    selectionLayer: {
      entity: selectionEntity,
    },
    operationPreviewLayer: {
      previews: operationPreviews,
    },
    fragments,
    stockSize: model.bounds.size,
    disclaimer: derivedViewportDisclaimer,
  };
}

export type { ViewMode };
