import { useEffect, useMemo, useRef } from 'react';
import { Bounds, Line, OrbitControls, Text } from '@react-three/drei';
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ImportedModel, ModelEntity, OperationPreview, ViewMode } from '@cam/model';
import type { Operation } from '@cam/shared';
import { buildOperationPreviewLayer, buildScenePipeline, type ViewOrientation } from './viewportScene';

type Viewport3DProps = {
  model: ImportedModel;
  operations: Operation[];
  selectedFeatureId: string | null;
  selectedOperationId: string | null;
  selectedGeometryId: string | null;
  onSelectFeature: (featureId: string) => void;
  onSelectOperation: (operationId: string) => void;
  onSelectGeometry: (geometryId: string) => void;
  viewOrientation: ViewOrientation;
  viewMode: ViewMode;
};

function cameraPosition(stockSize: [number, number, number], orientation: ViewOrientation): THREE.Vector3 {
  const maxDimension = Math.max(...stockSize);
  const distance = maxDimension * 1.9;

  switch (orientation) {
    case 'top':
      return new THREE.Vector3(0, 0, distance);
    case 'front':
      return new THREE.Vector3(0, -distance, distance * 0.35);
    case 'right':
      return new THREE.Vector3(distance, 0, distance * 0.3);
    case 'fit':
      return new THREE.Vector3(distance * 0.9, -distance * 0.8, distance * 0.75);
    case 'isometric':
      return new THREE.Vector3(distance, -distance, distance * 0.9);
  }
}

function CameraRig({ stockSize, viewOrientation, selectedPosition }: { stockSize: [number, number, number]; viewOrientation: ViewOrientation; selectedPosition: [number, number, number] | null }) {
  const { camera, invalidate } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const target = selectedPosition ? new THREE.Vector3(...selectedPosition) : new THREE.Vector3(0, 0, stockSize[2] * 0.2);
    const nextPosition = cameraPosition(stockSize, viewOrientation).add(target.clone());

    camera.position.copy(nextPosition);
    camera.lookAt(target);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    invalidate();
  }, [camera, invalidate, selectedPosition, stockSize, viewOrientation]);

  return <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault />;
}

function bodyOutlinePoints(size: [number, number, number]): Array<[number, number, number]> {
  const [length, width] = size;
  const halfLength = length / 2;
  const halfWidth = width / 2;
  return [
    [-halfLength, -halfWidth, 0],
    [halfLength, -halfWidth, 0],
    [halfLength, halfWidth, 0],
    [-halfLength, halfWidth, 0],
    [-halfLength, -halfWidth, 0],
  ];
}

function EntityMesh({
  entity,
  fragment,
  selected,
  wireframe,
  onSelectFeature,
  onSelectGeometry,
}: {
  entity: ModelEntity;
  fragment: ImportedModel['fragments'][number] | undefined;
  selected: boolean;
  wireframe: boolean;
  onSelectFeature: (featureId: string) => void;
  onSelectGeometry: (geometryId: string) => void;
}) {
  const baseColor = selected ? '#f8fafc' : fragment?.color ?? '#94a3b8';
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (entity.featureId) {
      onSelectFeature(entity.featureId);
      return;
    }
    onSelectGeometry(entity.id);
  };

  if (!fragment) {
    return null;
  }

  const outlinePoints = bodyOutlinePoints(fragment.size);

  if (fragment.kind === 'hole_marker') {
    return (
      <group position={fragment.position} onClick={select}>
        <mesh>
          <cylinderGeometry args={[Math.max(fragment.size[0] / 2, 2), Math.max(fragment.size[0] / 2, 2), Math.max(fragment.size[2], 2), 28]} />
          <meshStandardMaterial color={baseColor} transparent opacity={wireframe ? 0.18 : 0.6} emissive={selected ? '#38bdf8' : '#000000'} wireframe={wireframe} />
        </mesh>
      </group>
    );
  }

  if (fragment.kind === 'contour_path') {
    return (
      <group position={[fragment.position[0], fragment.position[1], fragment.position[2] + fragment.size[2] / 2]} onClick={select}>
        <Line points={outlinePoints} color={baseColor} lineWidth={selected ? 3.2 : 2.2} />
      </group>
    );
  }

  if (fragment.kind === 'geometry_path' && fragment.points.length >= 2) {
    return (
      <group position={[0, 0, fragment.position[2]]} onClick={select}>
        <Line points={fragment.points} color={baseColor} lineWidth={selected ? 2.8 : fragment.closed ? 2.2 : 1.6} />
      </group>
    );
  }

  if (fragment.kind === 'geometry_point') {
    return (
      <group position={fragment.position} onClick={select}>
        <mesh>
          <sphereGeometry args={[selected ? 1.2 : 0.8, 16, 16]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
      </group>
    );
  }

  if (fragment.kind === 'text_marker') {
    return (
      <group position={[fragment.position[0], fragment.position[1], fragment.position[2] + 0.6]} onClick={select}>
        <mesh>
          <boxGeometry args={fragment.size} />
          <meshStandardMaterial color={baseColor} transparent opacity={wireframe ? 0.12 : 0.4} emissive={selected ? '#38bdf8' : '#000000'} wireframe={wireframe} />
        </mesh>
        <Text position={[0, 0, fragment.size[2] / 2 + 0.6]} fontSize={Math.max(fragment.size[1] * 0.5, 2.2)} maxWidth={fragment.size[0]} color={selected ? '#f8fafc' : '#fdba74'} anchorX="center" anchorY="middle">
          {fragment.text ?? fragment.label}
        </Text>
      </group>
    );
  }

  return (
    <group position={fragment.position} onClick={select}>
      <mesh>
        <boxGeometry args={fragment.size} />
        <meshStandardMaterial color={baseColor} transparent opacity={wireframe ? 0.12 : fragment.kind === 'edge_marker' ? 0.5 : 0.42} emissive={selected ? '#38bdf8' : '#000000'} wireframe={wireframe} />
      </mesh>
      <Line points={outlinePoints} color={selected ? '#e0f2fe' : baseColor} lineWidth={selected ? 2.8 : 1.6} />
    </group>
  );
}

function OperationPreviewMesh({ preview, entity, fragment, selected, onSelect }: { preview: OperationPreview; entity: ModelEntity | undefined; fragment: ImportedModel['fragments'][number] | undefined; selected: boolean; onSelect: (operationId: string) => void }) {
  const depthAssumed = (preview.depthProfile?.depthStatus === 'assumed' || preview.depthProfile?.depthStatus === 'unknown' || preview.depthProfile?.assumptions.length);
  const color = selected ? '#f8fafc' : preview.warnings.length > 0 ? '#f59e0b' : preview.source === 'manual' ? '#fb7185' : preview.source === 'edited' ? '#c084fc' : depthAssumed ? '#facc15' : '#38bdf8';
  const position = fragment?.position ?? entity?.bounds.center ?? [0, 0, 0];
  const size = fragment?.size ?? entity?.bounds.size ?? [12, 12, 1.5];
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(preview.operationId);
  };
  const firstPath = preview.paths[0];
  const firstSegment = firstPath?.segments[0];
  const firstSegmentPoints = firstSegment?.points ?? [];
  const depthLabel = preview.depthProfile?.targetDepthMm !== undefined
    ? `Z ${preview.depthProfile.targetDepthMm.toFixed(1)} mm`
    : preview.depthAnnotations[0] ?? '';

  if (preview.kind === 'contour_path' && firstSegmentPoints.length >= 2) {
    return (
      <group key={preview.id} position={[0, 0, 0]} onClick={select}>
        <Line points={firstSegmentPoints} color={color} lineWidth={selected ? 3.4 : 2.4} />
        {depthLabel ? (
          <Text position={[position[0], position[1], position[2] + 2]} fontSize={1.6} color={color} anchorX="center" anchorY="middle">
            {depthLabel}
          </Text>
        ) : null}
      </group>
    );
  }

  if (preview.kind === 'hole_marker') {
    return (
      <group key={preview.id} position={[position[0], position[1], position[2] + size[2] / 2 + 1.2]} onClick={select}>
        <mesh>
          <cylinderGeometry args={[Math.max(size[0] / 3, 1.5), Math.max(size[0] / 3, 1.5), Math.max(size[2] * 0.6, 2), 24]} />
          <meshStandardMaterial color={color} transparent opacity={0.18} wireframe />
        </mesh>
        {depthLabel ? (
          <Text position={[0, 0, Math.max(size[2] * 0.6, 2)]} fontSize={1.5} color={color} anchorX="center" anchorY="middle">
            {depthLabel}
          </Text>
        ) : null}
      </group>
    );
  }

  if (preview.kind === 'edge_marker') {
    return (
      <group key={preview.id} position={[0, 0, 0]} onClick={select}>
        <Line points={firstSegment?.points ?? bodyOutlinePoints([Math.max(size[0], 4), Math.max(size[1], 4), size[2]])} color={color} lineWidth={selected ? 3.4 : 2.4} />
        {depthLabel ? (
          <Text position={[position[0], position[1], position[2] + 2]} fontSize={1.5} color={color} anchorX="center" anchorY="middle">
            {depthLabel}
          </Text>
        ) : null}
      </group>
    );
  }

  return (
    <group key={preview.id} position={[position[0], position[1], position[2] + size[2] / 2 + 1.4]} onClick={select}>
        <mesh>
          <boxGeometry args={[Math.max(size[0] * 0.9, 4), Math.max(size[1] * 0.9, 4), 0.6]} />
        <meshStandardMaterial color={color} transparent opacity={0.18} wireframe />
      </mesh>
      <Text position={[0, 0, 1.1]} fontSize={Math.max(size[1] * 0.18, 1.6)} maxWidth={size[0]} color={color} anchorX="center" anchorY="middle">
        {preview.label}
      </Text>
      {depthLabel ? (
        <Text position={[0, -Math.max(size[1] * 0.22, 1.4), 1.1]} fontSize={1.2} maxWidth={size[0]} color={color} anchorX="center" anchorY="middle">
          {depthLabel}
        </Text>
      ) : null}
    </group>
  );
}

function DerivedScene({ model, operations, selectedFeatureId, selectedOperationId, selectedGeometryId, onSelectFeature, onSelectOperation, onSelectGeometry, viewOrientation, viewMode }: Viewport3DProps) {
  const operationPreviews = useMemo(() => buildOperationPreviewLayer(model, operations), [model, operations]);
  const scene = useMemo(
    () => buildScenePipeline(model, operationPreviews, selectedFeatureId, selectedOperationId, selectedGeometryId),
    [model, operationPreviews, selectedFeatureId, selectedOperationId, selectedGeometryId],
  );
  const selectedEntity = scene.selectionLayer.entity;
  const stockEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(...scene.stockSize)),
    [scene.stockSize],
  );
  const fragmentById = scene.fragments;
  const entityById = useMemo(() => new Map(model.entities.map((entity) => [entity.id, entity])), [model.entities]);
  const wireframe = viewMode === 'wireframe';
  const showImportedGeometry = true;
  const showFeatures = viewMode === 'shaded' || viewMode === 'wireframe' || viewMode === 'features';
  const showOperationPreview = viewMode === 'operation_preview' || Boolean(selectedOperationId) || Boolean(selectedFeatureId);
  const stockOpacity = viewMode === 'stock' ? 0.42 : 0.22;

  return (
    <>
      <CameraRig stockSize={scene.stockSize} viewOrientation={viewOrientation} selectedPosition={selectedEntity?.bounds.center ?? null} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[scene.stockSize[0], scene.stockSize[1], scene.stockSize[2] * 2]} intensity={1.2} />
      <gridHelper args={[Math.max(scene.stockSize[0], scene.stockSize[1]) * 1.5, 12, '#1d4ed8', '#1e293b']} />
      <axesHelper args={[Math.max(...scene.stockSize) * 0.45]} />
      <Bounds fit clip observe margin={1.25}>
        <group>
          <mesh position={[0, 0, 0]} onClick={() => onSelectFeature('')}>
            <boxGeometry args={scene.stockSize} />
            <meshStandardMaterial color="#0f172a" transparent opacity={stockOpacity} roughness={0.55} metalness={0.1} wireframe={wireframe || viewMode === 'stock'} />
          </mesh>
          <lineSegments geometry={stockEdges}>
            <lineBasicMaterial color="#94a3b8" />
          </lineSegments>
          {showImportedGeometry
            ? scene.importedGeometryLayer.entities.map((entity) => (
                <EntityMesh
                  key={entity.id}
                  entity={entity}
                  fragment={fragmentById.get(entity.fragmentIds[0] ?? '')}
                  selected={selectedGeometryId === entity.id || scene.selectionLayer.entity?.id === entity.id}
                  wireframe
                  onSelectFeature={onSelectFeature}
                  onSelectGeometry={onSelectGeometry}
                />
              ))
            : null}
          {showFeatures
            ? scene.featureLayer.entities.map((entity) => (
                <EntityMesh
                  key={entity.id}
                  entity={entity}
                  fragment={fragmentById.get(entity.fragmentIds[0] ?? '')}
                  selected={selectedFeatureId === entity.featureId}
                  wireframe={wireframe || viewMode === 'features'}
                  onSelectFeature={onSelectFeature}
                  onSelectGeometry={onSelectGeometry}
                />
              ))
            : null}
          {showOperationPreview
            ? scene.operationPreviewLayer.previews.map((preview) => (
                <OperationPreviewMesh
                  key={preview.id}
                  preview={preview}
                  entity={preview.entityId ? entityById.get(preview.entityId) : undefined}
                   fragment={fragmentById.get(preview.fragmentIds[0] ?? '')}
                   selected={selectedOperationId === preview.operationId || selectedFeatureId === preview.featureId}
                   onSelect={onSelectOperation}
                 />
               ))
            : null}
          {scene.selectionLayer.entity ? (
            <group position={scene.selectionLayer.entity.bounds.center}>
              <mesh>
                <boxGeometry args={[scene.selectionLayer.entity.bounds.size[0] + 2.5, scene.selectionLayer.entity.bounds.size[1] + 2.5, scene.selectionLayer.entity.bounds.size[2] + 1.5]} />
                <meshStandardMaterial color="#f8fafc" transparent opacity={0.08} wireframe />
              </mesh>
            </group>
          ) : null}
        </group>
      </Bounds>
    </>
  );
}

export function Viewport3D(props: Viewport3DProps) {
  const disclaimer = useMemo(
    () =>
      buildScenePipeline(
        props.model,
        buildOperationPreviewLayer(props.model, props.operations),
        props.selectedFeatureId,
        props.selectedOperationId,
        props.selectedGeometryId,
      ).disclaimer,
    [props.model, props.operations, props.selectedFeatureId, props.selectedOperationId, props.selectedGeometryId],
  );

  return (
    <div className="viewport-stage">
      <Canvas camera={{ position: [180, -180, 140], fov: 42 }} dpr={[1, 2]} gl={{ localClippingEnabled: true }}>
        <color attach="background" args={['#020617']} />
        <DerivedScene {...props} />
      </Canvas>
      <div className="viewport-overlay">
        <strong>Derived model + operation preview view</strong>
        <span>{disclaimer}</span>
      </div>
    </div>
  );
}
