'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { abandonHeldAction, applyAction, canUseHotspot, visibleHotspots } from '../el-origen/game';
import { observeVisibility } from '../el-origen/director';
import { clearCurrentSaveForDevelopment, hasValidStoredGame, isolateOldSaves, loadStoredGame, saveStoredGame } from '../el-origen/persistence';
import { ActionId, GameState, Hotspot } from '../el-origen/types';
import NotebookPanel from './NotebookPanel';
import SceneView from './SceneView';
import styles from '../styles/elOrigen.module.css';

const devDebugAllowed = process.env.NODE_ENV !== 'production';

export default function Experience() {
  const [state, setState] = useState<GameState | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subtitles, setSubtitles] = useState(true);
  const [debug, setDebug] = useState(false);
  const [volume, setVolume] = useState(0.42);
  const [hasContinue, setHasContinue] = useState(false);
  const [coverOpen, setCoverOpen] = useState(true);
  const audioRef = useRef<AudioEngine | null>(null);
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
      setDebug(new URLSearchParams(window.location.search).get('debug') === '1');
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

  const hotspots = useMemo(() => (state ? visibleHotspots(state) : []), [state]);

  const audio = async () => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    await audioRef.current.unlock();
    audioRef.current.setMasterVolume(volume);
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
      if (sound === 'paper') engine.playPaperRustle();
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
    }

    const next = commit(applyAction(current, action));
    if (action === 'enter' || action === 'continue') setCoverOpen(false);
    if (action === 'startAgain') setCoverOpen(true);
    playFor(hotspot, action);
    if (next.flags.notebookFound && action === 'takeNotebook') setNotebookOpen(true);
  };

  const abandonHold = () => {
    const current = stateRef.current ?? state;
    if (!current) return;
    commit(abandonHeldAction(current));
  };

  if (!state) {
    return (
      <main className={styles.black}>
        <p>La casa abre la cerradura...</p>
      </main>
    );
  }

  if (state.scene === 'ending') {
    return (
      <main className={styles.endingShell}>
        <section className={styles.endingPaper}>
          <p className={styles.paperKicker}>La casa guarda esta versión</p>
          <h1>EL ORIGEN</h1>
          <p>{state.notice}</p>
          <p className={styles.finalQuestion}>¿Cuánto vale una casa cuando por fin deja de obedecer?</p>
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
    const enterLabel = state.memory.entries > 0 ? 'Volver a entrar' : 'Entrar';
    return (
      <main className={styles.cover}>
        <section className={styles.coverCard} aria-label="Portada">
          <p className={styles.paperKicker}>casa de la abuela</p>
          <h1>EL ORIGEN</h1>
          <button onClick={() => runAction('enter')} type="button">{enterLabel}</button>
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
        onHoldAbandoned={abandonHold}
        onHotspot={(hotspot) => runAction(hotspot.action, hotspot)}
        state={state}
      />

      <aside className={styles.caseNote} aria-label="orden de trabajo">
        <p className={styles.paperKicker}>orden de trabajo</p>
        <h2>Tasación pendiente</h2>
        <ol>
          {objectivesFor(state).map((objective) => (
            <li className={objective.done ? styles.doneObjective : ''} key={objective.text}>{objective.text}</li>
          ))}
        </ol>
      </aside>

      {state.scene === 'living' && state.flags.tv1986Seen && (
        <aside className={styles.tvSignal} aria-label="transmisión ficticia de 1986">
          <p>JUNIO · 1986</p>
          <strong>LA CASA JUEGA DE LOCAL</strong>
          <span>avance: cocina → servicio → archivo · deuda acumulada: visible</span>
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
    </main>
  );
}

function objectivesFor(state: GameState) {
  return [
    { text: 'Leer el sobre y entrar a la casa.', done: Boolean(state.flags.envelopeRead && state.flags.doorOpened) },
    { text: 'Contrastar carpeta, heladera y llaves.', done: Boolean(state.flags.folderFound && state.flags.fridgeChecked && state.flags.keyringSeen) },
    { text: 'Encontrar la libreta azul y cruzarla con el plano.', done: Boolean(state.flags.notebookFound && state.flags.planOverlayDone) },
    { text: 'Descubrir quién mide tu conducta.', done: Boolean(state.flags.behaviorProfileSeen) },
    { text: state.flags.valuationReady ? 'Decidir si firmar, rechazar o exponer.' : 'Volver al living y revisar la tasación.', done: Boolean(state.ending) },
  ];
}
