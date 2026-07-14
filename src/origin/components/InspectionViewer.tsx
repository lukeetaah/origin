'use client';

import { type CSSProperties, type MouseEvent, useEffect, useMemo, useState } from 'react';
import { GameState, InspectableObject, InspectionClue, InspectionClueId, InspectionSide } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type InspectionViewerProps = {
  object: InspectableObject;
  state: GameState;
  onClose: () => void;
  onDiscover: (objectId: string, clueId: InspectionClueId) => void;
};

type LightZone = NonNullable<InspectionClue['lightZone']>;

const sideOrder: InspectionSide[] = ['front', 'back', 'left', 'right', 'top', 'base', 'inside'];
const sideLabels: Record<InspectionSide, string> = {
  front: 'frente',
  back: 'dorso',
  left: 'izquierda',
  right: 'derecha',
  top: 'arriba',
  base: 'base',
  inside: 'interior',
};
const lightLabels: Record<LightZone, string> = {
  left: 'luz izquierda',
  center: 'luz centro',
  right: 'luz derecha',
  top: 'luz arriba',
  bottom: 'luz abajo',
};
const lightPoints: Record<LightZone, { x: string; y: string }> = {
  left: { x: '24%', y: '48%' },
  center: { x: '50%', y: '46%' },
  right: { x: '76%', y: '48%' },
  top: { x: '50%', y: '18%' },
  bottom: { x: '50%', y: '78%' },
};

export default function InspectionViewer({ object, state, onClose, onDiscover }: InspectionViewerProps) {
  const [side, setSide] = useState<InspectionSide>('front');
  const [lightZone, setLightZone] = useState<LightZone>('center');
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const discovered = useMemo(
    () => state.objectStates[object.objectId]?.discoveredClues ?? [],
    [object.objectId, state.objectStates],
  );
  const visibleClues = useMemo(
    () => object.clues.filter((clue) => discovered.includes(clue.id)),
    [discovered, object.clues],
  );
  const latestClue = visibleClues.at(-1);
  const pendingClue = object.clues.find((clue) => !discovered.includes(clue.id));
  const availableSides = useMemo(() => sidesFor(object), [object]);
  const lightPoint = lightPoints[lightZone];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const clue = object.clues.find((candidate) => clueVisible(candidate, side, lightZone, open, discovered));
    if (!clue) return;
    const revealTimer = window.setTimeout(() => {
      setFlash(clue.reveal);
      onDiscover(object.objectId, clue.id);
    }, 240);
    const clearTimer = window.setTimeout(() => setFlash(null), 2200);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearTimer);
    };
  }, [discovered, lightZone, object, onDiscover, open, side]);

  const close = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  };

  const toggleOpen = () => {
    setOpen((value) => {
      const next = !value;
      if (next && availableSides.includes('inside')) setSide('inside');
      if (!next && side === 'inside') setSide('front');
      return next;
    });
  };

  return (
    <section
      aria-label={`inspección de ${object.title}`}
      aria-modal="true"
      className={styles.inspectionOverlay}
      role="dialog"
      style={{ '--ix': lightPoint.x, '--iy': lightPoint.y } as CSSProperties}
    >
      <div className={styles.inspectionBackdrop} />
      <div className={styles.inspectionLight} />
      <button
        aria-label="Salir de la inspección"
        className={styles.closeInspection}
        onClick={close}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        salir
      </button>

      <div className={styles.inspectionLayout}>
        <aside className={styles.inspectionBrief}>
          <p className={styles.paperKicker}>objeto</p>
          <h2>{object.title}</h2>
          <p>{latestClue ? object.afterClueObservation : object.initialObservation}</p>
          <small>{object.instruction}</small>
        </aside>

        <main className={styles.inspectionStage} aria-live="polite">
          <div
            aria-label={`${object.title}, vista ${sideLabels[side]}`}
            className={`${styles.inspectedObject} ${objectClass(object)}`}
            data-open={open ? 'true' : 'false'}
            data-side={side}
          >
            <span className={styles.objectFold} />
            <span className={styles.objectSeal} />
            <span className={styles.objectMark}>{objectMark(object, latestClue, side, open)}</span>
          </div>
          {flash && <p className={styles.clueFlash}>{flash}</p>}
        </main>

        <aside className={styles.cluePanel}>
          <p className={styles.paperKicker}>lectura</p>
          {latestClue ? (
            <article className={styles.inspectionEvidence}>
              <strong>{latestClue.title}</strong>
              <p>{latestClue.fact}</p>
              <em>{latestClue.question}</em>
            </article>
          ) : (
            <article className={styles.inspectionHint}>
              <strong>Todavía no hay pista.</strong>
              <p>{pendingClue ? hintFor(pendingClue, side, lightZone, open) : 'Este objeto ya no tiene más que decir.'}</p>
            </article>
          )}
          {visibleClues.length > 1 && (
            <ol className={styles.foundClues}>
              {visibleClues.map((clue) => (
                <li key={clue.id}>{clue.title}</li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <footer className={styles.inspectionControls} aria-label="controles de inspección">
        <div>
          <span>mirar</span>
          {availableSides.map((candidate) => (
            <button
              className={candidate === side ? styles.activeInspectionControl : undefined}
              key={candidate}
              onClick={() => setSide(candidate)}
              type="button"
            >
              {sideLabels[candidate]}
            </button>
          ))}
        </div>
        <div>
          <span>linterna</span>
          {(Object.keys(lightLabels) as LightZone[]).map((candidate) => (
            <button
              className={candidate === lightZone ? styles.activeInspectionControl : undefined}
              key={candidate}
              onClick={() => setLightZone(candidate)}
              type="button"
            >
              {lightLabels[candidate]}
            </button>
          ))}
        </div>
        {(object.canOpen || object.canDisassemble) && (
          <button className={styles.inspectToggle} onClick={toggleOpen} type="button">
            {open ? 'cerrar objeto' : object.canDisassemble ? 'desarmar' : 'abrir objeto'}
          </button>
        )}
        <span className={styles.inspectionProgress}>{visibleClues.length} de {object.clues.length} pistas</span>
      </footer>
    </section>
  );
}

function sidesFor(object: InspectableObject) {
  const sides = new Set<InspectionSide>(['front']);
  for (const clue of object.clues) sides.add(clue.side);
  if (object.model === 'keys' || object.model === 'sensor') sides.add('base');
  if (object.model === 'photo' || object.model === 'document') sides.add('back');
  return sideOrder.filter((side) => sides.has(side));
}

function clueVisible(
  clue: InspectionClue,
  side: InspectionSide,
  lightZone: LightZone,
  open: boolean,
  discovered: InspectionClueId[],
) {
  if (discovered.includes(clue.id)) return false;
  if (clue.requiresOpen && !open) return false;
  if (clue.side !== side) return false;
  if (clue.requiresLight && clue.lightZone !== lightZone) return false;
  return true;
}

function hintFor(clue: InspectionClue, side: InspectionSide, lightZone: LightZone, open: boolean) {
  if (clue.requiresOpen && !open) return 'Primero abrí el objeto. La pista está adentro, no en la tapa.';
  if (clue.side !== side) return `Cambiá la vista a ${sideLabels[clue.side]}.`;
  if (clue.requiresLight && clue.lightZone !== lightZone && clue.lightZone) {
    return `Mové la linterna: ${lightLabels[clue.lightZone]}.`;
  }
  return 'Mantené esta vista un instante. La marca debería aparecer.';
}

function objectClass(object: InspectableObject) {
  if (object.model === 'photo') return styles.photoArtifact;
  if (object.model === 'keys') return styles.keysArtifact;
  if (object.model === 'notebook') return styles.notebookArtifact;
  if (object.model === 'folder') return styles.folderArtifact;
  if (object.model === 'sensor') return styles.sensorArtifact;
  return styles.paperArtifact;
}

function objectMark(object: InspectableObject, latestClue: InspectionClue | undefined, side: InspectionSide, open: boolean) {
  if (latestClue) return latestClue.title;
  if (open && side === 'inside') return 'interior';
  if (side === 'back') return object.model === 'photo' ? 'fecha al dorso' : 'reverso';
  if (side === 'base') return 'base';
  if (object.model === 'keys') return 'llaves';
  if (object.model === 'sensor') return 'punto rojo';
  if (object.model === 'notebook') return 'azul';
  if (object.model === 'folder') return 'carpeta';
  return 'papel';
}
