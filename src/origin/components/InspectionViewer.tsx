'use client';

import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GameState, InspectableObject, InspectionClue, InspectionClueId } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type InspectionViewerProps = {
  object: InspectableObject;
  state: GameState;
  onClose: () => void;
  onDiscover: (objectId: string, clueId: InspectionClueId) => void;
};

type Rotation = { x: number; y: number };
type LightPoint = { x: number; y: number };

export default function InspectionViewer({ object, state, onClose, onDiscover }: InspectionViewerProps) {
  const [webgl] = useState(() => canUseWebgl());
  const [rotation, setRotation] = useState<Rotation>({ x: -0.18, y: 0.32 });
  const [light, setLight] = useState<LightPoint>({ x: 56, y: 42 });
  const [zoom, setZoom] = useState(4.2);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const dragging = useRef<{ x: number; y: number; rotation: Rotation } | null>(null);
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const discovered = useMemo(
    () => state.objectStates[object.objectId]?.discoveredClues ?? [],
    [object.objectId, state.objectStates],
  );
  const currentSide = sideFromRotation(rotation, open);
  const currentLightZone = zoneFromLight(light);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const clue = object.clues.find((candidate) => clueVisible(candidate, currentSide, currentLightZone, open, discovered));
    if (!clue) return;
    const revealTimer = window.setTimeout(() => {
      setFlash(clue.reveal);
      onDiscover(object.objectId, clue.id);
    }, 0);
    const clearTimer = window.setTimeout(() => setFlash(null), 1500);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearTimer);
    };
  }, [currentLightZone, currentSide, discovered, object, onDiscover, open]);

  const visibleClues = useMemo(
    () => object.clues.filter((clue) => discovered.includes(clue.id)),
    [discovered, object.clues],
  );

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragging.current = { x: event.clientX, y: event.clientY, rotation };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextLight = {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    };
    setLight((previous) => ({
      x: previous.x + (nextLight.x - previous.x) * 0.38,
      y: previous.y + (nextLight.y - previous.y) * 0.38,
    }));

    if (!touches.current.has(event.pointerId)) return;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...touches.current.values()];
    if (points.length >= 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      setZoom(Math.min(5.8, Math.max(2.7, 620 / Math.max(120, distance))));
      return;
    }
    if (!dragging.current) return;
    const dx = event.clientX - dragging.current.x;
    const dy = event.clientY - dragging.current.y;
    setRotation({
      x: clamp(dragging.current.rotation.x + dy / 180, -1.45, 1.45),
      y: dragging.current.rotation.y + dx / 150,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size === 0) dragging.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    setZoom((value) => clamp(value + event.deltaY * 0.003, 2.7, 5.8));
  };

  return (
    <section
      aria-label={`inspección: ${object.title}`}
      className={styles.inspectionOverlay}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={{ '--ix': `${light.x}%`, '--iy': `${light.y}%` } as React.CSSProperties}
    >
      <div className={styles.inspectionBackdrop} />
      <div className={styles.inspectionLight} />
      <button className={styles.closeInspection} onClick={onClose} type="button">salir</button>

      <aside className={styles.inspectionBrief}>
        <p className={styles.paperKicker}>objeto</p>
        <h2>{object.title}</h2>
        <p>{visibleClues.length > 0 ? object.afterClueObservation : object.initialObservation}</p>
        <small>{object.instruction}</small>
      </aside>

      {object.canOpen && (
        <button className={styles.inspectToggle} onClick={() => setOpen((value) => !value)} type="button">
          {open ? 'cerrar' : 'abrir'}
        </button>
      )}

      {flash && <p className={styles.clueFlash}>{flash}</p>}

      <div className={styles.inspectionCanvas}>
        {webgl ? (
          <Canvas camera={{ position: [0, 0, zoom], fov: 42 }} dpr={[1, 1.5]}>
            <color attach="background" args={['#050604']} />
            <ambientLight intensity={0.12} />
            <pointLight
              color="#ffe6a6"
              intensity={2.2}
              position={[(light.x - 50) / 16, (50 - light.y) / 16, 3.2]}
            />
            <group rotation={[rotation.x, rotation.y, 0]}>
              <InspectableModel object={object} open={open} visibleClues={visibleClues} />
            </group>
          </Canvas>
        ) : (
          <div className={styles.inspectionFallback}>
            <strong>{object.title}</strong>
            <p>{object.initialObservation}</p>
            <p>WebGL no está disponible. La pista puede leerse desde la libreta al activar modo compatible.</p>
          </div>
        )}
      </div>

      <footer className={styles.inspectionTelemetry}>
        <span>{currentSide}</span>
        <span>luz: {currentLightZone}</span>
        <span>{visibleClues.length}/{object.clues.length} pistas</span>
      </footer>
    </section>
  );
}

function InspectableModel({ object, open, visibleClues }: { object: InspectableObject; open: boolean; visibleClues: InspectionClue[] }) {
  const clueText = visibleClues.at(-1)?.title ?? '';
  if (object.model === 'photo') return <PhotoModel object={object} clueText={clueText} />;
  if (object.model === 'keys') return <KeysModel clueText={clueText} />;
  if (object.model === 'notebook') return <NotebookModel clueText={clueText} open={open} />;
  if (object.model === 'folder' || object.model === 'document') return <FolderModel object={object} clueText={clueText} open={open} />;
  if (object.model === 'sensor') return <SensorModel clueText={clueText} />;
  return <BoxModel object={object} clueText={clueText} />;
}

function PhotoModel({ object, clueText }: { object: InspectableObject; clueText: string }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[2.25, 1.35, 0.045]} />
        <meshStandardMaterial color="#e3d4a9" roughness={0.72} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[1.82, 1.02]} />
        <meshStandardMaterial color="#534734" roughness={0.5} />
      </mesh>
      <Text color="#f7eec7" fontSize={0.07} maxWidth={1.65} position={[0, -0.5, 0.07]}>
        {object.initialObservation}
      </Text>
      <Text color="#233025" fontSize={0.08} maxWidth={1.8} position={[0, 0, -0.055]} rotation={[0, Math.PI, 0]}>
        {clueText || 'dorso sin mirar'}
      </Text>
    </group>
  );
}

function FolderModel({ object, open, clueText }: { object: InspectableObject; open: boolean; clueText: string }) {
  const angle = open ? -0.95 : -0.08;
  return (
    <group>
      <mesh position={[0.55, 0, 0]} rotation={[0, angle, 0]}>
        <boxGeometry args={[1.15, 1.55, 0.04]} />
        <meshStandardMaterial color={object.model === 'document' ? '#d8cca2' : '#b59a57'} roughness={0.82} />
      </mesh>
      <mesh position={[-0.55, 0, 0]}>
        <boxGeometry args={[1.15, 1.55, 0.045]} />
        <meshStandardMaterial color="#c1a766" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.03, -0.035]}>
        <boxGeometry args={[1.85, 1.32, 0.018]} />
        <meshStandardMaterial color="#eee0b8" roughness={0.92} />
      </mesh>
      <Text color="#2e2417" fontSize={0.08} maxWidth={1.55} position={[0, -0.48, 0.04]}>
        {open ? clueText || 'pliegue sin revisar' : object.initialObservation}
      </Text>
    </group>
  );
}

function KeysModel({ clueText }: { clueText: string }) {
  return (
    <group>
      <mesh position={[-0.55, 0.42, 0]}>
        <torusGeometry args={[0.32, 0.035, 12, 36]} />
        <meshStandardMaterial color="#b6aa82" metalness={0.75} roughness={0.28} />
      </mesh>
      {[-0.35, 0, 0.34].map((x, index) => (
        <group key={x} rotation={[0, 0, -0.35 + index * 0.22]} position={[x, -0.08 - index * 0.08, 0]}>
          <mesh>
            <boxGeometry args={[0.12, 0.92, 0.055]} />
            <meshStandardMaterial color="#b8ad86" metalness={0.8} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.34, 0.2, 0.055]} />
            <meshStandardMaterial color="#b8ad86" metalness={0.8} roughness={0.22} />
          </mesh>
        </group>
      ))}
      <Text color="#d8eef2" fontSize={0.085} maxWidth={1.6} position={[0.42, -0.72, 0.08]}>
        {clueText || 'falta una etiqueta'}
      </Text>
    </group>
  );
}

function NotebookModel({ open, clueText }: { open: boolean; clueText: string }) {
  return (
    <group>
      <mesh position={[-0.46, 0, 0]} rotation={[0, open ? 0.72 : 0.06, 0]}>
        <boxGeometry args={[0.92, 1.52, 0.07]} />
        <meshStandardMaterial color="#203a67" roughness={0.78} />
      </mesh>
      <mesh position={[0.46, 0, 0]} rotation={[0, open ? -0.72 : -0.06, 0]}>
        <boxGeometry args={[0.92, 1.52, 0.065]} />
        <meshStandardMaterial color="#1d335a" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[1.35, 1.36, 0.035]} />
        <meshStandardMaterial color="#e9dfbd" roughness={0.9} />
      </mesh>
      <Text color="#263243" fontSize={0.075} maxWidth={1.25} position={[0, -0.45, 0.06]}>
        {open ? clueText || 'las páginas esperan luz' : 'cuaderno azul'}
      </Text>
    </group>
  );
}

function SensorModel({ clueText }: { clueText: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.25, 0.82, 0.42]} />
        <meshStandardMaterial color="#20251f" roughness={0.58} metalness={0.08} />
      </mesh>
      <mesh position={[0.42, 0.18, 0.24]}>
        <sphereGeometry args={[0.08, 24, 16]} />
        <meshStandardMaterial color="#b33a2c" emissive="#6f0e08" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, -0.36, -0.23]} rotation={[Math.PI, 0, 0]}>
        <boxGeometry args={[0.72, 0.22, 0.02]} />
        <meshStandardMaterial color="#d8cfaa" roughness={0.85} />
      </mesh>
      <Text color="#f1e0b1" fontSize={0.075} maxWidth={1.05} position={[0, -0.56, -0.26]} rotation={[Math.PI, 0, 0]}>
        {clueText || 'base sin leer'}
      </Text>
    </group>
  );
}

function BoxModel({ object, clueText }: { object: InspectableObject; clueText: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.4, 1, 0.75]} />
        <meshStandardMaterial color="#786044" roughness={0.78} />
      </mesh>
      <Text color="#f4e7bd" fontSize={0.08} maxWidth={1.1} position={[0, -0.62, 0.42]}>
        {clueText || object.initialObservation}
      </Text>
    </group>
  );
}

function clueVisible(
  clue: InspectionClue,
  side: string,
  lightZone: string,
  open: boolean,
  discovered: InspectionClueId[],
) {
  if (discovered.includes(clue.id)) return false;
  if (clue.requiresOpen && !open) return false;
  if (clue.side !== side) return false;
  if (clue.requiresLight && clue.lightZone !== lightZone) return false;
  return true;
}

function sideFromRotation(rotation: Rotation, open: boolean) {
  if (open && Math.abs(rotation.y) < 1.25) return 'inside';
  if (rotation.x > 1.0) return 'top';
  if (rotation.x < -1.0) return 'base';
  const yaw = normalize(rotation.y);
  if (Math.abs(yaw) > 2.35) return 'back';
  if (yaw > 0.95) return 'right';
  if (yaw < -0.95) return 'left';
  return 'front';
}

function zoneFromLight(light: LightPoint) {
  if (light.y < 30) return 'top';
  if (light.y > 70) return 'bottom';
  if (light.x < 38) return 'left';
  if (light.x > 62) return 'right';
  return 'center';
}

function normalize(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canUseWebgl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}
