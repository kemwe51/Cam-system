import { useEffect, useMemo, useRef } from 'react';
import { Bounds, Line, OrbitControls, Text } from '@react-three/drei';
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { DraftCamPlan, PartInput } from '@cam/shared';
import { buildScenePipeline, type DerivedBody, type ScenePipeline, type ViewMode, type ViewOrientation } from './viewportScene';

type Viewport3DProps = {
  part: PartInput;
  features: DraftCamPlan['features'];
  operations: DraftCamPlan['operations'];
  selectedFeatureId: string | null;
  selectedOperationId: string | null;
  onSelectFeature: (featureId: string) => void;
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

function CameraRig({
  stockSize,
  viewOrientation,
  selectedFeaturePosition,
}: {
  stockSize: [number, number, number];
  viewOrientation: ViewOrientation;
  selectedFeaturePosition: [number, number, number] | null;
}) {
  const { camera, invalidate } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const target = selectedFeaturePosition
      ? new THREE.Vector3(...selectedFeaturePosition)
      : new THREE.Vector3(0, 0, stockSize[2] * 0.2);
    const nextPosition = cameraPosition(stockSize, viewOrientation).add(target.clone());

    camera.position.copy(nextPosition);
    camera.lookAt(target);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    invalidate();
  }, [camera, invalidate, selectedFeaturePosition, stockSize, viewOrientation]);

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

function FeatureMesh({
  entity,
  selected,
  onSelect,
  wireframe,
}: {
  entity: DerivedBody;
  selected: boolean;
  onSelect: (featureId: string) => void;
  wireframe: boolean;
}) {
  const baseColor = selected ? '#f8fafc' : entity.color;
  const emissive = selected ? '#38bdf8' : '#000000';
  const outlinePoints = useMemo(() => bodyOutlinePoints(entity.size), [entity.size]);

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(entity.featureId);
  };

  if (entity.kind === 'hole_group') {
    const diameter = Math.max(entity.size[0] / Math.max(entity.quantity, 1), 2.5);
    const rows = entity.quantity > 2 ? 2 : 1;
    const columns = Math.max(Math.ceil(entity.quantity / rows), 1);
    return (
      <group position={entity.position} onClick={select}>
        {Array.from({ length: entity.quantity }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const xOffset = columns === 1 ? 0 : (column - (columns - 1) / 2) * Math.max(diameter * 1.6, 5);
          const yOffset = rows === 1 ? 0 : ((rows - 1) / 2 - row) * Math.max(diameter * 1.8, 6);
          return (
            <mesh key={`${entity.featureId}-${index}`} position={[xOffset, yOffset, -entity.size[2] / 2]} onClick={select}>
              <cylinderGeometry args={[diameter / 2, diameter / 2, entity.size[2], 28]} />
              <meshStandardMaterial color={baseColor} transparent opacity={wireframe ? 0.18 : 0.65} emissive={emissive} wireframe={wireframe} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (entity.kind === 'contour') {
    return (
      <group position={[entity.position[0], entity.position[1], entity.position[2] + entity.size[2] / 2]} onClick={select}>
        <Line points={outlinePoints} color={baseColor} lineWidth={selected ? 3.2 : 2.2} />
      </group>
    );
  }

  if (entity.kind === 'engraving') {
    return (
      <group position={[entity.position[0], entity.position[1], entity.position[2] + 0.6]} onClick={select}>
        <mesh>
          <boxGeometry args={[entity.size[0], entity.size[1], entity.size[2]]} />
          <meshStandardMaterial color={baseColor} transparent opacity={wireframe ? 0.12 : 0.55} emissive={emissive} wireframe={wireframe} />
        </mesh>
        <Text
          position={[0, 0, entity.size[2] / 2 + 0.6]}
          fontSize={Math.max(entity.size[1] * 0.55, 2.2)}
          maxWidth={entity.size[0]}
          color={selected ? '#f8fafc' : '#fdba74'}
          anchorX="center"
          anchorY="middle"
        >
          {entity.text}
        </Text>
      </group>
    );
  }

  return (
    <group position={entity.position} onClick={select}>
      <mesh>
        <boxGeometry args={entity.size} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={wireframe ? 0.12 : entity.kind === 'top_surface' ? 0.22 : entity.kind === 'chamfer' ? 0.55 : 0.48}
          emissive={emissive}
          wireframe={wireframe || entity.kind === 'top_surface'}
        />
      </mesh>
      <Line points={outlinePoints} color={selected ? '#e0f2fe' : baseColor} lineWidth={selected ? 2.8 : 1.6} />
    </group>
  );
}

function OperationOverlayMeshes({ overlays }: { overlays: ScenePipeline['operationOverlays'] }) {
  return (
    <group>
      {overlays.map((overlay) => (
        <group key={overlay.operationId} position={overlay.position}>
          <mesh>
            <boxGeometry args={overlay.size} />
            <meshStandardMaterial color={overlay.color} transparent opacity={overlay.enabled ? 0.18 : 0.12} wireframe />
          </mesh>
          <Text
            position={[0, 0, overlay.size[2] + 0.5]}
            fontSize={Math.max(overlay.size[1] * 0.18, 1.7)}
            maxWidth={overlay.size[0]}
            color={overlay.color}
            anchorX="center"
            anchorY="middle"
          >
            {overlay.origin === 'manual' ? `M · ${overlay.label}` : overlay.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

function DerivedScene({
  part,
  features,
  operations,
  selectedFeatureId,
  selectedOperationId,
  onSelectFeature,
  viewOrientation,
  viewMode,
}: Viewport3DProps) {
  const scene = useMemo(
    () => buildScenePipeline(part, features, operations, selectedFeatureId, selectedOperationId),
    [features, operations, part, selectedFeatureId, selectedOperationId],
  );
  const selectedEntity = scene.featureBodies.find((entity) => entity.featureId === selectedFeatureId) ?? null;
  const stockEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(...scene.stockBody.size)),
    [scene.stockBody.size],
  );
  const wireframe = viewMode === 'wireframe';
  const showFeatures = viewMode !== 'stock_only' && viewMode !== 'operations';
  const showOperations = viewMode === 'operations' || Boolean(selectedOperationId);

  return (
    <>
      <CameraRig
        stockSize={scene.stockBody.size}
        viewOrientation={viewOrientation}
        selectedFeaturePosition={selectedEntity?.position ?? null}
      />
      <ambientLight intensity={0.8} />
      <directionalLight position={[scene.stockBody.size[0], scene.stockBody.size[1], scene.stockBody.size[2] * 2]} intensity={1.2} />
      <gridHelper args={[Math.max(scene.stockBody.size[0], scene.stockBody.size[1]) * 1.5, 12, '#1d4ed8', '#1e293b']} />
      <axesHelper args={[Math.max(...scene.stockBody.size) * 0.45]} />
      <Bounds fit clip observe margin={1.25}>
        <group>
          <mesh position={[0, 0, 0]} onClick={() => onSelectFeature('')}>
            <boxGeometry args={scene.stockBody.size} />
            <meshStandardMaterial
              color="#0f172a"
              transparent
              opacity={viewMode === 'stock_only' ? 0.42 : 0.22}
              roughness={0.55}
              metalness={0.1}
              wireframe={wireframe}
            />
          </mesh>
          <lineSegments geometry={stockEdges}>
            <lineBasicMaterial color="#94a3b8" />
          </lineSegments>
          {showFeatures
            ? scene.featureBodies.map((entity) => (
                <FeatureMesh
                  key={entity.featureId}
                  entity={entity}
                  selected={selectedFeatureId === entity.featureId}
                  onSelect={onSelectFeature}
                  wireframe={wireframe || viewMode === 'features'}
                />
              ))
            : null}
          {showOperations ? <OperationOverlayMeshes overlays={scene.operationOverlays} /> : null}
          {scene.selectionOverlay ? (
            <group position={scene.selectionOverlay.position}>
              <mesh>
                <boxGeometry args={scene.selectionOverlay.size} />
                <meshStandardMaterial color={scene.selectionOverlay.color} transparent opacity={0.08} wireframe />
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
    () => buildScenePipeline(props.part, props.features, props.operations, props.selectedFeatureId, props.selectedOperationId).disclaimer,
    [props.features, props.operations, props.part, props.selectedFeatureId, props.selectedOperationId],
  );

  return (
    <div className="viewport-stage">
      <Canvas camera={{ position: [180, -180, 140], fov: 42 }} dpr={[1, 2]} gl={{ localClippingEnabled: true }}>
        <color attach="background" args={['#020617']} />
        <DerivedScene {...props} />
      </Canvas>
      <div className="viewport-overlay">
        <strong>Derived 3D workpiece view</strong>
        <span>{disclaimer}</span>
      </div>
    </div>
  );
}
