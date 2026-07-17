'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { abandonHeldAction, applyAction, canUseHotspot, discoverInspectionClue, markObjectInspected, triggerFlashlightEvent, visibleHotspots } from '../el-origen/game';
import { observeVisibility } from '../el-origen/director';
import { clearCurrentSaveForDevelopment, hasValidStoredGame, isolateOldSaves, loadStoredGame, saveStoredGame } from '../el-origen/persistence';
import { getInspectableObject } from '../el-origen/inspection';
import { ActionId, EndingId, GameState, Hotspot } from '../el-origen/types';
import InspectionViewer from './InspectionViewer';
import NotebookPanel from './NotebookPanel';
import SceneView from './SceneView';
import styles from '../styles/elOrigen.module.css';

const devDebugAllowed = process.env.NODE_ENV !== 'production';
const DEADLINE_TOTAL_SECONDS = 19 * 60;
const DEADLINE_CLOCK_SECONDS = 20 * 60 * 60;

export default function Experience() {
  const [state, setState] = useState<GameState | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subtitles, setSubtitles] = useState(true);
  const [debug, setDebug] = useState(false);
  const [volume, setVolume] = useState(0.42);
  const [hasContinue, setHasContinue] = useState(false);
  const [coverOpen, setCoverOpen] = useState(true);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<AudioEngine | null>(null);
  const audioStartedRef = useRef(false);
  const stateRef = useRef<GameState | null>(null);

  useEffect(() => {
    isolateOldSaves();
    if (devDebugAllowed && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fresh') === '1') {
      clearCurrentSaveForDevelopment();
    }
    const loaded = loadStoredGame();
    const saved = saveStoredGame(loaded);
    stateRef.current = saved;
    setState(saved);
    setHasContinue(hasValidStoredGame() && saved.started && saved.scene !== 'ending');
    if (devDebugAllowed && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setDebug(params.get('debug') === '1' || params.get('debugHotspots') === '1');
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setState((current) => {
        if (!current) return current;
        const saved = saveStoredGame(observeVisibility(current, document.hidden));
        stateRef.current = saved;
        return saved;
      });
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  useEffect(() => {
    if (!state?.scene || state.scene === 'ending' || !audioRef.current) return;
    audioRef.current.playSceneAmbient(state.scene);
  }, [state?.scene]);

  useEffect(() => {
    audioRef.current?.setMasterVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioRef.current?.setRoomToneIntensity(Math.min(4, (state?.facts.length ?? 0) / 3));
  }, [state?.facts.length]);

  useEffect(() => () => {
    audioRef.current?.destroy();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    if (!state?.started || state.scene === 'ending') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.scene, state?.started]);

  const hotspots = useMemo(() => (state ? visibleHotspots(state) : []), [state]);
  const inspectionObject = inspectionId ? getInspectableObject(inspectionId) : undefined;
  const deadline = state ? deadlineFor(state, now) : null;

  const audio = async () => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    await audioRef.current.unlock();
    audioRef.current.setMasterVolume(volume);
    if (!audioStartedRef.current) {
      const current = stateRef.current;
      audioRef.current.playSceneAmbient(current?.scene ?? 'door');
      audioRef.current.setRoomToneIntensity(Math.min(4, (current?.facts.length ?? 0) / 3));
      audioStartedRef.current = true;
    }
    return audioRef.current;
  };

  const commit = (next: GameState) => {
    const saved = saveStoredGame(next);
    stateRef.current = saved;
    setState(saved);
    setHasContinue(saved.started && saved.scene !== 'ending');
    return saved;
  };

  const playFor = (hotspot?: Hotspot, action?: ActionId) => {
    void audio().then((engine) => {
      const sound = hotspot?.sound;
      if (action === 'acceptLowPrice' || action === 'refusePrice' || action === 'exposeProtocol' || action === 'writeNameAndHangNotebook') {
        engine.playStamp();
        engine.playHoldSilence();
      }
      else if (sound === 'paper') engine.playPaperRustle();
      else if (sound === 'door') engine.playCreak(72);
      else if (sound === 'ceramic') engine.playLocker();
      else if (sound === 'radio') engine.playTVStatic(0.18, 1200);
      else if (sound === 'intercom') engine.playIntercom();
      else if (sound === 'pot') engine.playWoodTap();
      else if (sound === 'pencil') engine.playStamp();
      else if (sound === 'silence') engine.playHoldSilence();
      else if (action === 'wait') engine.playHum(1600, 48);
      else engine.playWoodTap();
    }).catch(() => {});
  };

  const runAction = (action: ActionId, hotspot?: Hotspot) => {
    const current = stateRef.current ?? state;
    if (!current) return;

    if (hotspot) {
      const usable = canUseHotspot(current, hotspot);
      if (!usable.ok) {
        commit({ ...current, notice: usable.reason ?? 'Todavía no.' });
        void audio().then((engine) => engine.playLocked()).catch(() => {});
        return;
      }
      if (hotspot.inspectable) {
        commit(markObjectInspected(current, hotspot.inspectable));
        setInspectionId(hotspot.inspectable);
        playFor(hotspot, action);
        return;
      }
    }

    commit(applyAction(current, action));
    if (action === 'enter' || action === 'continue') setCoverOpen(false);
    if (action === 'startAgain') setCoverOpen(true);
    playFor(hotspot, action);
  };

  const beginFreshRun = () => {
    const current = stateRef.current ?? state;
    if (!current) return;
    const fresh = applyAction(applyAction(current, 'startAgain'), 'enter');
    commit(fresh);
    setInspectionId(null);
    setNotebookOpen(false);
    setCoverOpen(false);
    void audio().then((engine) => engine.playCreak(68)).catch(() => {});
  };

  const abandonHold = () => {
    const current = stateRef.current ?? state;
    if (!current) return;
    commit(abandonHeldAction(current));
  };

  const discoverClue = (objectId: string, clueId: string) => {
    const current = stateRef.current ?? state;
    if (!current) return;
    const saved = commit(discoverInspectionClue(current, objectId, clueId));
    void audio().then((engine) => {
      engine.playMemoryUnlock();
      if (saved.flags.strongStartleUsed) engine.playDoorSlam();
    }).catch(() => {});
  };

  const reactToLight = (objectId: string) => {
    const current = stateRef.current ?? state;
    if (!current) return;
    const before = current.director.flashlightEvents.length;
    const saved = commit(triggerFlashlightEvent(current, objectId));
    if (saved.director.flashlightEvents.length === before) return;
    void audio().then((engine) => {
      if (objectId === 'hidden-panel') engine.playDoorSlam();
      else if (objectId === 'service-plan') engine.playDirectionalKnock(-0.65);
      else if (objectId === 'behavior-sensor') engine.playIntercom();
      else if (objectId === 'family-photo') engine.playDelayedStep(0.55);
      else engine.playWoodTap();
    }).catch(() => {});
  };

  const manipulateObject = () => {
    void audio().then((engine) => engine.playPaperRustle()).catch(() => {});
  };

  if (!state) {
    return (
      <main className={styles.black}>
        <p>La casa abre la cerradura...</p>
      </main>
    );
  }

  if (state.scene === 'ending') {
    const ending = endingPresentation(state.ending);
    return (
      <main className={styles.endingShell}>
        <section className={styles.endingPaper}>
          <p className={styles.paperKicker}>resultado registrado</p>
          <h1>EL ORIGEN</h1>
          <div className={styles.endingArtifact} data-ending={state.ending ?? 'resistir'} aria-label={ending.aria}>
            <span>{ending.kicker}</span>
            <strong>{ending.mark}</strong>
            <i />
          </div>
          <p>{state.notice}</p>
          <p className={styles.finalQuestion}>{ending.lastLine}</p>
          <div className={styles.endingActions}>
            <button onClick={() => runAction('startAgain')} type="button">Volver a entrar</button>
            {state.notebook.length > 0 && <button onClick={() => setNotebookOpen(true)} type="button">abrir libreta</button>}
          </div>
        </section>
        {notebookOpen && <NotebookPanel state={state} onClose={() => setNotebookOpen(false)} />}
      </main>
    );
  }

  if (coverOpen || !state.started) {
    const enterLabel = state.memory.entries > 0 ? 'Volver a entrar' : 'Ir al departamento';
    return (
      <main className={styles.cover}>
        <div className={styles.coverParticles} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <section className={styles.coverCard} aria-label="Prólogo">
          <p className={styles.paperKicker}>mamá · 19:41</p>
          <h1>EL ORIGEN</h1>
          <div className={styles.prologueCopy}>
            <p>La inmobiliaria llega a las ocho.</p>
            <p>Sacá el cuaderno azul y la carpeta.</p>
            <p>La abuela sigue internada. Nadie entró desde marzo.</p>
          </div>
          <button onClick={hasContinue ? beginFreshRun : () => runAction('enter')} type="button">
            {hasContinue ? 'Nueva partida' : enterLabel}
          </button>
          {hasContinue && <button className={styles.secondaryButton} onClick={() => runAction('continue')} type="button">Continuar</button>}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <SceneView
        debug={devDebugAllowed && debug}
        hotspots={hotspots}
        key={state.scene}
        onHoldAbandoned={abandonHold}
        onHotspot={(hotspot) => runAction(hotspot.action, hotspot)}
        onLightFocus={reactToLight}
        state={state}
      />
      <div className={styles.ghostLayer} data-phase={ghostPhaseFor(state)} data-scene={state.scene} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {deadline && (
        <aside className={styles.deadlineHud} aria-label="cuenta regresiva de la inmobiliaria">
          <span>inmobiliaria 20:00</span>
          <strong>{deadline.remaining}</strong>
          <em>{deadline.clock}</em>
        </aside>
      )}

      <aside className={styles.caseNote} aria-label="orden de trabajo">
        <p className={styles.paperKicker}>orden breve</p>
        <h2>{objectiveFor(state).primary}</h2>
        {objectiveFor(state).secondary && <p className={styles.secondaryObjective}>{objectiveFor(state).secondary}</p>}
      </aside>

      {state.scene === 'living' && state.flags.tv1986Seen && (
        <aside className={styles.tvSignal} aria-label="transmisión ficticia de 1986">
          <p>JUNIO · 1986</p>
          <strong>SEGUNDA VISITA</strong>
          <span>cocina → servicio → archivo</span>
        </aside>
      )}

      {subtitles && <p className={styles.caption} aria-live="polite">{state.notice}</p>}

      <div className={styles.quietControls} aria-label="controles discretos">
        {state.flags.notebookFound && <button onClick={() => setNotebookOpen(true)} type="button">libreta</button>}
        <button onClick={() => setSettingsOpen((value) => !value)} type="button">sonido</button>
      </div>

      {settingsOpen && (
        <aside className={styles.settings} aria-label="ajustes">
          <button className={styles.closePaper} onClick={() => setSettingsOpen(false)} type="button">cerrar</button>
          <p className={styles.paperKicker}>ajustes</p>
          <label>
            Volumen
            <input
              max="1"
              min="0"
              onChange={(event) => setVolume(Number(event.target.value))}
              step="0.05"
              type="range"
              value={volume}
            />
          </label>
          <label className={styles.inlineToggle}>
            <input checked={subtitles} onChange={(event) => setSubtitles(event.target.checked)} type="checkbox" />
            subtítulos
          </label>
          {devDebugAllowed && (
            <label className={styles.inlineToggle}>
              <input checked={debug} onChange={(event) => setDebug(event.target.checked)} type="checkbox" />
              debug
            </label>
          )}
        </aside>
      )}

      {notebookOpen && <NotebookPanel state={state} onClose={() => setNotebookOpen(false)} />}
      {inspectionObject && (
        <InspectionViewer
          key={inspectionObject.objectId}
          object={inspectionObject}
          onClose={() => setInspectionId(null)}
          onDiscover={discoverClue}
          onManipulate={manipulateObject}
          state={state}
        />
      )}
    </main>
  );
}

function objectiveFor(state: GameState) {
  if (!state.flags.envelopeRead) return { primary: 'Abrí el sobre.', secondary: '' };
  if (!state.flags.doorOpened) return { primary: 'Entrá al departamento.', secondary: '' };
  if (!state.flags.folderFound) return { primary: 'Buscá la carpeta.', secondary: '' };
  if (!state.flags.notebookFound) return { primary: 'Encontrá el cuaderno azul.', secondary: '' };
  if (!state.flags.servicePlanSeen) return { primary: 'Revisá el pasillo de servicio.', secondary: '' };
  if (!state.flags.behaviorProfileSeen) return { primary: 'Tocá el punto rojo.', secondary: '' };
  if (!state.flags.truthUnderstood) return { primary: 'Uní cuaderno y plano.', secondary: '' };
  if (!state.flags.hiddenPanelOpened) return { primary: 'Abrí el panel.', secondary: '' };
  if (state.scene === 'service') return { primary: 'Entrá al hueco.', secondary: '' };
  if (!state.flags.valuationReady) return { primary: state.scene === 'living' ? 'Abrí la tasación.' : 'Volvé al living.', secondary: '' };
  return { primary: 'Elegí qué sale de la casa.', secondary: '' };
}

function deadlineFor(state: GameState, currentTime: number) {
  const elapsedSeconds = state.started ? Math.min(DEADLINE_TOTAL_SECONDS, Math.max(0, Math.floor((currentTime - state.startedAt) / 1000))) : 0;
  const remainingSeconds = Math.max(0, DEADLINE_TOTAL_SECONDS - elapsedSeconds);
  const clockSeconds = DEADLINE_CLOCK_SECONDS - remainingSeconds;
  return {
    remaining: formatDuration(remainingSeconds),
    clock: formatClock(clockSeconds),
  };
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function ghostPhaseFor(state: GameState) {
  if (!state.flags.doorOpened) return 'threshold';
  if (state.scene === 'hallway' && !state.flags.photoMismatch) return 'photo';
  if (state.scene === 'kitchen' && !state.flags.notebookFound) return 'tile';
  if (state.scene === 'bedroom' && !state.flags.keyringSeen) return 'bed';
  if (state.scene === 'service' && !state.flags.hiddenPanelOpened) return 'service';
  if (state.scene === 'hidden') return 'archive';
  return state.flags.truthUnderstood ? 'awake' : 'breathing';
}

function endingPresentation(ending: EndingId | null) {
  if (ending === 'ceder') return {
    aria: 'Tasación firmada y retirada de la casa.',
    kicker: 'tasación aceptada',
    mark: 'FIRMADO',
    lastLine: 'La planilla ya decía: “firmará”.',
  };
  if (ending === 'exponer') return {
    aria: 'Expediente atado con todas las pruebas del método.',
    kicker: 'archivo completo',
    mark: 'COPIA AFUERA',
    lastLine: 'El archivo ya decía: “hará una copia”.',
  };
  if (ending === 'despertar') return {
    aria: 'Cuaderno azul colgado sobre el plano de la casa.',
    kicker: 'nombre agregado',
    mark: 'NO SE VENDE',
    lastLine: 'Tu letra coincide con la visita anterior.',
  };
  return {
    aria: 'Tasación cruzada con una tachadura de rechazo.',
    kicker: 'precio rechazado',
    mark: 'NO',
    lastLine: 'La planilla ya decía: “tachará”.',
  };
}
