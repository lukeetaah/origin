'use client';

import { PointerEvent, useEffect, useRef, useState } from 'react';
import { requirementsMet, sceneRegistry } from '../el-origen/scenes';
import { getObjectRecord, sceneObjects } from '../el-origen/objects';
import { GameState, Hotspot } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type SceneViewProps = {
  state: GameState;
  hotspots: Hotspot[];
  debug: boolean;
  onHotspot: (hotspot: Hotspot) => void;
  onHoldAbandoned: () => void;
  onLightFocus: (objectId: string) => void;
};

type HoldingState = {
  id: string;
  label: string;
  duration: number;
};

export default function SceneView({ state, hotspots, debug, onHotspot, onHoldAbandoned, onLightFocus }: SceneViewProps) {
  const scene = state.scene === 'ending' ? sceneRegistry.door : sceneRegistry[state.scene];
  const initialFocus = initialFocusFor(hotspots);
  const [pointer, setPointer] = useState(initialFocus);
  const [light, setLight] = useState(initialFocus);
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

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setLight((current) => ({
        x: current.x + (pointer.x - current.x) * 0.18,
        y: current.y + (pointer.y - current.y) * 0.18,
      }));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [pointer.x, pointer.y]);

  const litFocus = hotspots.find((hotspot) => hotspot.requiresLight && isHotspotLit(hotspot, light));

  useEffect(() => {
    if (!litFocus?.objectId) return;
    const timer = window.setTimeout(() => onLightFocus(litFocus.objectId), 1200);
    return () => window.clearTimeout(timer);
  }, [litFocus?.objectId, onLightFocus]);

  const clearHold = (abandoned: boolean) => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (abandoned && holding && !holdCompleted.current) onHoldAbandoned();
    setHolding(null);
    holdCompleted.current = false;
  };

  const startHotspot = (event: PointerEvent<HTMLButtonElement>, hotspot: Hotspot, lit: boolean) => {
    updatePointer(event);
    if (!lit || !hotspot.holdMs) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdCompleted.current = false;
    setHolding({ id: hotspot.id, label: hotspot.verb, duration: hotspot.holdMs });
    holdTimer.current = window.setTimeout(() => {
      holdCompleted.current = true;
      holdTimer.current = null;
      setHolding(null);
      if (hotspot.inspectable) onLightFocus(hotspot.objectId);
      onHotspot(hotspot);
    }, hotspot.holdMs);
  };

  const backgroundStyle = scene.background.kind === 'image'
    ? { '--bg': `url(${scene.background.src})` }
    : { '--bg': 'none' };
  const ratio = scene.background.width / scene.background.height;
  const debugHotspots = scene.hotspots.map((hotspot) => ({
    hotspot,
    object: getObjectRecord(hotspot.objectId),
    active: hotspots.some((visible) => visible.id === hotspot.id),
    gated: !requirementsMet(state, hotspot.visibleWhen ?? []),
  }));
  const sceneObjectWarnings = sceneObjects(scene.id).filter((object) => !scene.hotspots.some((hotspot) => hotspot.id === object.hotspotId));

  return (
    <section
      aria-label={scene.aria}
      className={styles.stage}
      onPointerMove={updatePointer}
      style={{
        '--lx': `${pointer.x}%`,
        '--ly': `${pointer.y}%`,
        '--flx': `${light.x}%`,
        '--fly': `${light.y}%`,
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
        <div className={styles.backdropLit} />
        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />
        <div className={styles.flashlight} aria-hidden="true" />
        <div className={styles.flashlightHandle} aria-hidden="true">
          <i />
        </div>

        {hotspots.map((hotspot) => {
          const lit = isHotspotLit(hotspot, light);
          const interactiveLit = lit || Boolean(hotspot.inspectable);
          return (
            <button
              aria-label={`${hotspot.label}: ${hotspot.verb}`}
              className={`${styles.hotspot} ${styles[`layer_${hotspot.layer ?? 'mid'}`]}`}
              data-gesture={hotspot.gesture ?? 'tap'}
              data-hotspot={hotspot.id}
              data-lit={interactiveLit ? 'true' : 'false'}
              data-changed={state.objectStates[hotspot.objectId]?.changed ? 'true' : 'false'}
              data-object-id={hotspot.objectId}
              disabled={!interactiveLit}
              key={hotspot.id}
              onClick={() => {
                if (interactiveLit && !hotspot.holdMs) {
                  if (hotspot.inspectable) onLightFocus(hotspot.objectId);
                  onHotspot(hotspot);
                }
              }}
              onKeyDown={(event) => {
                if (!interactiveLit || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                clearHold(false);
                if (hotspot.inspectable) onLightFocus(hotspot.objectId);
                onHotspot(hotspot);
              }}
              onPointerCancel={() => clearHold(true)}
              onPointerDown={(event) => startHotspot(event, hotspot, interactiveLit)}
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
          );
        })}

        {holding && (
          <div className={styles.holdCue} style={{ '--hold-ms': `${holding.duration}ms` } as React.CSSProperties}>
            <i />
            <span>{holding.label}</span>
          </div>
        )}

        {debug && (
          <div className={styles.debugLayer} aria-hidden="true">
            <p>
              {scene.id} · {scene.background.kind === 'image' ? scene.background.src : scene.background.style}
              {' · '}x {pointer.x.toFixed(1)} / y {pointer.y.toFixed(1)}
              {' · '}luz {light.x.toFixed(1)} / {light.y.toFixed(1)}
              {sceneObjectWarnings.length > 0 ? ` · WARN objetos sin hotspot: ${sceneObjectWarnings.map((object) => object.id).join(', ')}` : ''}
            </p>
            {debugHotspots.map(({ hotspot, object, active, gated }) => (
              <i
                data-active={active ? 'true' : 'false'}
                data-warning={object ? 'false' : 'true'}
                key={`debug-${hotspot.id}`}
                style={{
                  left: `${hotspot.rect.x}%`,
                  top: `${hotspot.rect.y}%`,
                  width: `${hotspot.rect.w}%`,
                  height: `${hotspot.rect.h}%`,
                }}
              >
                {hotspot.id}
                <b>{object?.internalName ?? 'SIN OBJETO'}</b>
                <small>
                  {active ? 'activo' : gated ? 'bloqueado' : 'oculto'} · {hotspot.rect.x}/{hotspot.rect.y}/{hotspot.rect.w}/{hotspot.rect.h}
                </small>
              </i>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function initialFocusFor(hotspots: Hotspot[]) {
  const target = hotspots.find((hotspot) => hotspot.inspectable)
    ?? hotspots.find((hotspot) => hotspot.requiresLight)
    ?? hotspots[0];

  if (!target) return { x: 50, y: 48 };
  return {
    x: target.rect.x + target.rect.w / 2,
    y: target.rect.y + target.rect.h / 2,
  };
}

function isHotspotLit(hotspot: Hotspot, light: { x: number; y: number }) {
  if (!hotspot.requiresLight) return true;
  const center = {
    x: hotspot.rect.x + hotspot.rect.w / 2,
    y: hotspot.rect.y + hotspot.rect.h / 2,
  };
  const distance = Math.hypot(center.x - light.x, (center.y - light.y) * 1.18);
  return distance <= (hotspot.lightRadius ?? 26);
}
