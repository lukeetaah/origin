'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { GameState, InspectableObject, InspectionClue } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

export type EnvelopeState = 'closed' | 'opening' | 'open';

type InspectionViewerProps = {
  state: GameState;
  object: InspectableObject;
  onClose: () => void;
  onDiscover: (objectId: string, clueId: string) => void;
  onManipulate?: () => void;
};

export default function InspectionViewer({ state, object, onClose, onDiscover, onManipulate }: InspectionViewerProps) {
  const saved = state.objectStates[object.objectId];
  const firstClue = object.clues[0];
  const alreadyFound = Boolean(firstClue && saved?.discoveredClues.includes(firstClue.id));
  const [phase, setPhase] = useState<EnvelopeState>(saved?.open ? 'open' : 'closed');
  const [revealing, setRevealing] = useState(false);
  const [locallyFound, setLocallyFound] = useState(alreadyFound);
  const revealTimer = useRef<number | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const discoveredHere = useRef(alreadyFound);

  const discover = useCallback((clue: InspectionClue | undefined) => {
    if (!clue || discoveredHere.current) return;
    discoveredHere.current = true;
    setLocallyFound(true);
    onDiscover(object.objectId, clue.id);
  }, [object.objectId, onDiscover]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    };
  }, [onClose]);

  useEffect(() => {
    if (phase !== 'opening') return;
    const fallback = window.setTimeout(() => {
      setPhase('open');
      discover(firstClue);
    }, 520);
    return () => window.clearTimeout(fallback);
  }, [discover, firstClue, phase]);

  const open = () => {
    if (phase !== 'closed') return;
    onManipulate?.();
    setPhase('opening');
  };

  const beginReveal = (event: PointerEvent<HTMLButtonElement>) => {
    if (discoveredHere.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setRevealing(true);
    onManipulate?.();
    revealTimer.current = window.setTimeout(() => {
      revealTimer.current = null;
      setRevealing(false);
      discover(firstClue);
    }, 560);
  };

  const cancelReveal = () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    revealTimer.current = null;
    setRevealing(false);
  };

  const contentVisible = object.pattern === 'open' ? phase === 'open' : locallyFound;
  const observation = alreadyFound ? object.afterClueObservation : object.initialObservation;

  return (
    <div
      className={styles.inspectionOverlay}
      data-testid="inspection-viewer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label={`inspección de ${object.title}`}
        aria-modal="true"
        className={styles.inspectionScene}
        data-envelope-state={object.id === 'administrator-envelope' ? phase : undefined}
        data-pattern={object.pattern}
        role="dialog"
      >
        <header className={styles.inspectionHeader}>
          <div>
            <span>{object.pattern === 'open' ? 'abrir' : object.pattern === 'reveal' ? 'revelar' : 'observar'}</span>
            <h2>{object.title}</h2>
          </div>
          <button aria-label="Cerrar inspección" className={styles.inspectionClose} onClick={onClose} ref={closeButton} type="button">
            cerrar <kbd>Esc</kbd>
          </button>
        </header>

        <div className={styles.inspectionFocus}>
          <Artifact object={object} open={contentVisible} phase={phase} revealed={locallyFound} />

          {object.pattern === 'open' && phase === 'closed' && (
            <button className={styles.objectAction} onClick={open} type="button">{object.actionLabel ?? 'Abrir'}</button>
          )}
          {object.pattern === 'open' && phase === 'opening' && <span className={styles.objectWorking}>abriendo…</span>}

          {object.pattern === 'observe' && !locallyFound && (
            <button className={styles.attentionPoint} onClick={() => discover(firstClue)} type="button">
              {object.actionLabel ?? 'Mirar detalle'}
            </button>
          )}

          {object.pattern === 'reveal' && !locallyFound && (
            <button
              className={styles.revealPoint}
              data-revealing={revealing ? 'true' : 'false'}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') discover(firstClue);
              }}
              onPointerCancel={cancelReveal}
              onPointerDown={beginReveal}
              onPointerLeave={cancelReveal}
              onPointerUp={cancelReveal}
              type="button"
            >
              <i />
              {object.actionLabel ?? 'Mantené sobre la marca'}
            </button>
          )}
        </div>

        <footer className={styles.inspectionFooter} aria-live="polite">
          <p>{contentVisible || alreadyFound ? firstClue?.fact : observation}</p>
        </footer>
      </section>
    </div>
  );
}

function Artifact({ object, open, phase, revealed }: { object: InspectableObject; open: boolean; phase: EnvelopeState; revealed: boolean }) {
  if (object.id === 'administrator-envelope') {
    return (
      <div className={styles.envelopeArtifact} data-open={open ? 'true' : 'false'} data-phase={phase}>
        <div className={styles.envelopeBack} />
        <div aria-hidden={!open} className={styles.envelopeLetter}>
          <span>ADMINISTRACIÓN · copia</span>
          <strong>LUZ PAGADA · 11 JUN</strong>
          <p>Internación registrada: 03 JUN</p>
          <em>Firma: A. Ferrero</em>
        </div>
        <div aria-hidden={open} className={styles.envelopeFront}>
          <span>PARA LUCAS</span>
          <strong>RETIRAR ANTES DE LAS 20:00</strong>
        </div>
        <div className={styles.envelopeFlap} />
      </div>
    );
  }

  if (object.id === 'family-photo') {
    return (
      <div className={styles.photoArtifactSimple} data-revealed={revealed ? 'true' : 'false'}>
        <div><i /><i /><i /><b /></div>
        <span>CASA CERRADA DESDE MARZO</span>
        <strong aria-hidden={!revealed}>18 JUN · 19:12</strong>
      </div>
    );
  }

  if (object.id === 'grandmother-keyring') {
    return (
      <div className={styles.keyArtifactSimple}>
        <i /><i /><i />
        <span>COCINA</span><span>TERRAZA</span><span className={styles.cutTag}>AZUL</span>
      </div>
    );
  }

  if (object.id === 'behavior-sensor') {
    return (
      <div className={styles.sensorArtifactSimple} data-revealed={revealed ? 'true' : 'false'}>
        <i />
        <div aria-hidden={!revealed}>
          <span>PERFIL: LUCAS F.</span>
          <strong>VISITA 02</strong>
          <p>SOBRE 19:43 · COCINA PREVISTA</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.paperArtifactSimple} data-kind={object.id} data-open={open ? 'true' : 'false'}>
      <div aria-hidden={open} className={styles.paperCover}>
        <span>{object.id === 'blue-notebook' ? 'CUADERNO AZUL' : object.id === 'service-plan' ? 'PLANO ORIGINAL' : 'EXPEDIENTE'}</span>
        <strong>{object.title}</strong>
      </div>
      <div aria-hidden={!open} className={styles.paperInside}>
        <ArtifactCopy id={object.id} />
      </div>
    </div>
  );
}

function ArtifactCopy({ id }: { id: string }) {
  if (id === 'kitchen-folder') return <><span>OFERTA · 02 JUN</span><strong>INTERNACIÓN · 03 JUN</strong><p>Condición: “casa abandonada”.</p><em>Firma requerida: Lucas F.</em></>;
  if (id === 'blue-notebook') return <><span>VISITAS</span><strong>Cortar luz. Mover muebles.</strong><p>Repetir: “te estás confundiendo”.</p><em>Lucas: segunda visita.</em></>;
  if (id === 'service-plan') return <><span>PLANO REGISTRADO</span><strong>El servicio fue borrado.</strong><p>La pared conserva la ruta.</p><em>Entrada azul.</em></>;
  if (id === 'valuation-folder') return <><span>OPERACIÓN · 17 JUN</span><strong>SELECCIÓN REGISTRADA</strong><p>Firma cargada: Lucas F.</p><em>Resultado pendiente.</em></>;
  return <><span>ARCHIVO</span><strong>Una fecha no coincide.</strong><p>La casa seguía en uso.</p></>;
}
