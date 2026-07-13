'use client';

import { PointerEvent, useRef, useState } from 'react';
import { sceneRegistry } from '../el-origen/scenes';
import { GameState, Hotspot } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type SceneViewProps = {
  state: GameState;
  hotspots: Hotspot[];
  debug: boolean;
  onHotspot: (hotspot: Hotspot) => void;
  onHoldAbandoned: () => void;
};

type HoldingState = {
  id: string;
  label: string;
  duration: number;
};

export default function SceneView({ state, hotspots, debug, onHotspot, onHoldAbandoned }: SceneViewProps) {
  const scene = state.scene === 'ending' ? sceneRegistry.door : sceneRegistry[state.scene];
  const [pointer, setPointer] = useState({ x: 50, y: 48 });
  const [holding, setHolding] = useState<HoldingState | null>(null);
  const holdTimer = useRef<number | null>(null);
  const holdCompleted = useRef(false);

  const updatePointer = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  };

  const clearHold = (abandoned: boolean) => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (abandoned && holding && !holdCompleted.current) onHoldAbandoned();
    setHolding(null);
    holdCompleted.current = false;
  };

  const startHotspot = (event: PointerEvent<HTMLButtonElement>, hotspot: Hotspot) => {
    updatePointer(event);
    if (!hotspot.holdMs) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdCompleted.current = false;
    setHolding({ id: hotspot.id, label: hotspot.verb, duration: hotspot.holdMs });
    holdTimer.current = window.setTimeout(() => {
      holdCompleted.current = true;
      holdTimer.current = null;
      setHolding(null);
      onHotspot(hotspot);
    }, hotspot.holdMs);
  };

  const backgroundStyle = scene.background.kind === 'image'
    ? { '--bg': `url(${scene.background.src})` }
    : { '--bg': 'none' };
  const ratio = scene.background.width / scene.background.height;

  return (
    <section
      className={styles.stage}
      aria-label={scene.aria}
      onPointerMove={updatePointer}
      style={{
        '--lx': `${pointer.x}%`,
        '--ly': `${pointer.y}%`,
        '--ratio': String(ratio),
        ...backgroundStyle,
      } as React.CSSProperties}
    >
      <div
        className={styles.plane}
        data-scene={scene.id}
        data-visual={scene.background.kind === 'procedural' ? scene.background.style : 'image'}
        style={{ aspectRatio: `${scene.background.width} / ${scene.background.height}` }}
      >
        <div className={styles.backdrop} />
        {scene.background.kind === 'procedural' && <ProceduralSet kind={scene.background.style} />}
        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />
        <div className={styles.flashlight} aria-hidden="true" />

        {hotspots.map((hotspot) => (
          <button
            aria-label={`${hotspot.label}: ${hotspot.verb}`}
            className={`${styles.hotspot} ${styles[`layer_${hotspot.layer ?? 'mid'}`]}`}
            data-gesture={hotspot.gesture ?? 'tap'}
            data-hotspot={hotspot.id}
            key={hotspot.id}
            onClick={() => {
              if (!hotspot.holdMs) onHotspot(hotspot);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              clearHold(false);
              onHotspot(hotspot);
            }}
            onPointerCancel={() => clearHold(true)}
            onPointerDown={(event) => startHotspot(event, hotspot)}
            onPointerLeave={() => clearHold(true)}
            onPointerUp={() => clearHold(true)}
            style={{
              left: `${hotspot.rect.x}%`,
              top: `${hotspot.rect.y}%`,
              width: `${hotspot.rect.w}%`,
              height: `${hotspot.rect.h}%`,
            }}
            type="button"
          >
            <span>{hotspot.label}</span>
            <small>{hotspot.verb}</small>
          </button>
        ))}

        {holding && (
          <div className={styles.holdCue} style={{ '--hold-ms': `${holding.duration}ms` } as React.CSSProperties}>
            <i />
            <span>{holding.label}</span>
          </div>
        )}

        {debug && (
          <div className={styles.debugLayer} aria-hidden="true">
            <p>{scene.id} · x {pointer.x.toFixed(1)} / y {pointer.y.toFixed(1)}</p>
            {hotspots.map((hotspot) => (
              <i
                key={`debug-${hotspot.id}`}
                style={{
                  left: `${hotspot.rect.x}%`,
                  top: `${hotspot.rect.y}%`,
                  width: `${hotspot.rect.w}%`,
                  height: `${hotspot.rect.h}%`,
                }}
              >
                {hotspot.id}
              </i>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProceduralSet({ kind }: { kind: 'door' | 'service' | 'hidden' }) {
  if (kind === 'door') return <DoorSet />;
  if (kind === 'service') return <ServiceSet />;
  return <HiddenSet />;
}

function DoorSet() {
  return (
    <div className={`${styles.proceduralScene} ${styles.doorSet}`} aria-hidden="true">
      <div className={styles.corridorWall} />
      <div className={styles.apartmentDoor}>
        <i />
        <b />
        <span />
      </div>
      <div className={styles.envelopeProp} />
      <div className={styles.floorTiles} />
      <div className={styles.elevatorGlow} />
    </div>
  );
}

function ServiceSet() {
  return (
    <div className={`${styles.proceduralScene} ${styles.serviceSet}`} aria-hidden="true">
      <div className={styles.serviceWall} />
      <div className={styles.pipeColumn} />
      <div className={styles.meterBox} />
      <div className={styles.planPatch} />
      <div className={styles.falsePanel} />
      <div className={styles.serviceFloor} />
      <div className={styles.patioLight} />
    </div>
  );
}

function HiddenSet() {
  return (
    <div className={`${styles.proceduralScene} ${styles.hiddenSet}`} aria-hidden="true">
      <div className={styles.hiddenShelves}>
        {Array.from({ length: 12 }, (_, index) => <i key={`shelf-${index}`} />)}
      </div>
      <div className={styles.pencilWall}>
        {Array.from({ length: 10 }, (_, index) => <span key={`line-${index}`} />)}
      </div>
      <div className={styles.tileMouth} />
      <div className={styles.openDoorLine} />
      <div className={styles.hiddenDust} />
    </div>
  );
}
