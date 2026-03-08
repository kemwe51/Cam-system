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
  importedGeometryLayer: {
    entities: ModelEntity[];
  };
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
  'Derived viewport only: imported 2D geometry, extracted features, stock assumptions, and operation preview overlays are arranged from DXF/JSON import metadata and deterministic plan state. This is not a CAD kernel, solid model, or verified toolpath preview.';

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
  selectedGeometryId: string | null,
): ScenePipeline {
  const fragments = new Map(model.fragments.map((fragment) => [fragment.id, fragment]));
  const stockEntity = model.entities.find((entity) => entity.kind === 'stock') ?? null;
  const geometryEntities = model.entities.filter((entity) => entity.kind === 'source_geometry');
  const featureEntities = model.entities.filter((entity) => entity.kind === 'feature');
  const featureLink = selectedFeatureId ? model.featureGeometryLinks.find((link) => link.featureId === selectedFeatureId) : undefined;
  const selectedPreview = selectedOperationId ? operationPreviews.find((preview) => preview.operationId === selectedOperationId) : undefined;
  const selectionEntity = geometryEntities.find((entity) => entity.id === selectedGeometryId)
    ?? featureEntities.find((entity) => entity.featureId === selectedFeatureId)
    ?? (featureLink?.sourceGeometryIds[0] ? geometryEntities.find((entity) => entity.id === featureLink.sourceGeometryIds[0]) : null)
    ?? (selectedPreview?.entityId ? model.entities.find((entity) => entity.id === selectedPreview.entityId) : null)
    ?? model.entities.find((entity) => entity.operationId === selectedOperationId)
    ?? null;

  return {
    stockEntity,
    importedGeometryLayer: {
      entities: geometryEntities,
    },
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
