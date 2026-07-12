'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, @next/next/no-img-element */
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { nextPhysicalPrompt, sceneEntryLine } from '../engine/drama';
import { createInputHandlers, Gesture, InputSnapshot } from '../engine/input';
import { SessionEngine } from '../engine/memory';
import { Region, scenes, styleForRegion } from '../engine/scenes';
import { DramaticState, Scene } from '../engine/types';
import { canClose, endingFor } from '../engine/progression';
import Notebook, { NotebookTab } from './Notebook';
import effects from '../styles/effects.module.css';
import styles from '../styles/experience.module.css';
import tv from '../styles/tv.module.css';

type ActivePress = Parameters<typeof createInputHandlers>[0];
const discoveryMap: Record<string,string[]> = {'photo-back':['photo-back'],'wall-mark':['door-mark'],'radio-tuned':['radio-a'],'tv-86':['tv-memory'],'elvira-place':['chair-mark'],'family-photos':['recipe'],'tap-silence':['radio-b'],'mate-warm':['mate-seat'],'kettle-low':['recipe-date'],'table-set':['table-set'],'fridge-photo':['fridge-reflection','fridge-tub'],'cassette':['tapes','tape-wear'],'letter-open':['letter','child-voice']};

export default function Experience() {
  const engine = useRef<SessionEngine | null>(null);
  const audio = useRef<AudioEngine | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [scene, setScene] = useState<Scene>('hallway');
  const [phase, setPhase] = useState<DramaticState>('threshold');
  const [message, setMessage] = useState('');
  const [ending, setEnding] = useState<string | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const [active, setActive] = useState<ActivePress>(null);
  const [input, setInput] = useState<InputSnapshot>({ activeId: null, holdProgress: 0, pointer: null });
  const [renderedRect, setRenderedRect] = useState<{ w: number; h: number } | null>(null);
  const [, refresh] = useState(0);

  useEffect(() => {
    engine.current = new SessionEngine();
    audio.current = new AudioEngine();
    setDebug(new URLSearchParams(window.location.search).get('debug') === '1');
    engine.current.visit('hallway');
    const onVisibility = () => {
      if (document.hidden) {
        setActive(null);
        setInput(current => ({ ...current, activeId: null, holdProgress: 0 }));
        engine.current?.hide();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      audio.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!artRef.current) return;
    const measure = () => {
      const rect = artRef.current?.getBoundingClientRect();
      if (rect) setRenderedRect({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(artRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [started, scene]);

  const current = scenes[scene];
  const behavior = engine.current?.get().behavior;
  const visits = behavior?.objectVisits || {};
  const flags = Object.keys(visits).join(' ');
  const has = useCallback((id: string) => Boolean(engine.current?.has(id)), []);
  const reading = engine.current?.dominant() || 'exploring';

  const sceneRect = useCallback(() => artRef.current?.getBoundingClientRect() || null, []);
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const rect = sceneRect();
    if (!rect) return;
    setInput(previous => ({
      ...previous,
      pointer: {
        x: Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 1000)),
        y: Math.max(0, Math.min(1000, ((clientY - rect.top) / rect.height) * 1000)),
      },
    }));
  }, [sceneRect]);

  const say = useCallback((text: string, voice = true) => {
    setMessage(text);
    if (voice) audio.current?.speak(text);
    window.setTimeout(() => setMessage(currentText => currentText === text ? '' : currentText), 6200);
  }, []);

  const mark = useCallback((id: string, gesture: Gesture) => {
    engine.current?.act(id, gesture, scene);
    audio.current?.setRoomToneIntensity(Math.min(7, Object.keys(engine.current?.get().behavior.objectVisits || {}).length));
    refresh(value => value + 1);
  }, [scene]);

  const unlock = useCallback((id: string, text: string, gesture: Gesture = 'tap') => {
    const wasNew = !engine.current?.has(id);
    if (wasNew) {
      mark(id, gesture);
      engine.current?.discover(...(discoveryMap[id] || [id]));
      audio.current?.playMemoryUnlock();
    }
    say(text);
  }, [mark, say]);

  const move = useCallback((next: Scene) => {
    setScene(next);
    engine.current?.visit(next);
    audio.current?.playCreak();
    audio.current?.playSceneAmbient(next);
    const visitsToNext = engine.current?.get().behavior.sceneVisits[next] || 0;
    say(sceneEntryLine(next, has, visitsToNext), false);
    refresh(value => value + 1);
  }, [has, say]);

  const finish = useCallback((kind: 'mirror' | 'chair' | 'door') => {
    engine.current?.setDramaticState('consequence');
    setPhase('consequence');
    const state=engine.current?.get();
    if(state)setEnding(endingFor(kind,state));
    if (kind === 'door') audio.current?.playDoorSlam();
    else audio.current?.playHeartbeat(4200);
  }, []);

  const resolve = useCallback((region: Region, gesture: Gesture) => {
    const session = engine.current;
    if (!session) return;
    audio.current?.unlock();

    if (region.kind === 'exit') {
      if (region.id === 'exit') {
        if (engine.current && canClose(engine.current.get())) finish('door');
        else {
          audio.current?.playLocked();
          say(nextPhysicalPrompt(has), false);
        }
        return;
      }
      if (region.to) move(region.to);
      return;
    }

    if (region.id === 'photo') {
      if (gesture === 'hold') {
        setPhase('recognition');
        session.setDramaticState('recognition');
        audio.current?.playPaperRustle();
        unlock('photo-back', 'Elvira escribió: “Final del 86. Beto, por una vez salí en la foto”. Donde debería estar él, el papel está raspado.', 'hold');
      } else if (!has('photo-back')) {
        say('El marco cede un poco. No alcanza con tocarlo: hay que sostenerlo.', false);
      } else {
        say('Detrás del marco quedó pegado un pelo blanco y una esquina de negativo.', false);
      }
      return;
    }

    if (region.id === 'lamp') {
      audio.current?.playKnock();
      if (has('photo-back')) unlock('wall-mark', 'La luz encuentra un rectángulo más claro. Ahí colgó la única foto que Beto no sacó.', 'tap');
      else say('El aplique tiembla sobre el vidrio de la foto.', false);
      return;
    }

    if (region.id === 'radio') {
      if (gesture === 'drag') {
        setPhase('attention');
        audio.current?.playTVStatic(0.38, 1500);
        unlock('radio-tuned', 'La perilla raspa. Elvira se ríe: “Beto, dejá de filmar y vení a abrazarnos”. Malena grita un gol que todavía no ocurrió.', 'drag');
      } else {
        say('La radio no quiere un golpe. Quiere que la busquen despacio.', false);
      }
      return;
    }

    if (region.id === 'television') {
      audio.current?.playTVStatic(has('radio-tuned') ? 0.7 : 0.25, 1600);
      setPhase('confrontation');
      session.setDramaticState('confrontation');
      audio.current?.playWorldCupMemory();
      unlock('tv-86', has('radio-tuned') ? 'La familia tapa el partido discutiendo por una fuente. Debajo del ruido, alguien sigue grabando.' : 'El marcador tiembla. La discusión está, pero sin la radio todavía no distinguís quién acusa a quién.', 'tap');
      return;
    }

    if (region.id === 'chair') {
      if (gesture === 'hold' && engine.current && canClose(engine.current.get())) return finish('chair');
      if (has('tv-86')) unlock('elvira-place', 'En el tapizado quedó el círculo del mate de Elvira. La silla apunta a la cocina porque fue a buscar otra bandera.', 'tap');
      else say('El sillón mira la tele como si todavía faltaran seis minutos para ser campeones.', false);
      return;
    }

    if (region.id === 'living-window') {
      session.discover('window-open'); session.change('open-window');
      say(has('tv-86') ? 'Afuera alguien toca bocina. Adentro nadie se levanta.' : 'La lluvia baja solamente por el vidrio.', false);
      return;
    }

    if (region.id === 'family-photos') {
      unlock('family-photos', has('photo-back') ? 'Malena crece en cada foto. Elvira encanece. Beto sigue ausente: todos miran apenas por encima del lente, hacia él.' : 'La familia mira a una persona que la imagen no muestra.', 'tap');
      return;
    }

    if (region.id === 'tap') {
      audio.current?.playDrip();
      if (gesture === 'hold') unlock('tap-silence', 'Cuando cerrás la canilla, la cinta deja oír a Elvira: “siempre mirando, Beto. ¿Y vos cuándo vas a estar?”.', 'hold');
      else say('El goteo tapa una voz. Cerralo y quedate escuchando.', false);
      return;
    }

    if (region.id === 'kettle') {
      unlock('kettle-low', 'Bajás la llama. El vapor revela una fecha corregida y, debajo, “no tocar el repasador bueno”.', 'tap');
      return;
    }

    if (region.id === 'mate') {
      if (has('mate-warm') && (has('tap-silence') || has('kettle-low') || has('elvira-place')) && !has('table-set')) {
        unlock('table-set', 'Ponés el mate frente al lugar vacío. Por un segundo la silla cruje bajo el peso de Elvira.', 'hold');
        return;
      }
      if (gesture === 'hold') unlock('mate-warm', 'La yerba conserva el perfume de cedrón de Elvira. Malena lo odiaba; Beto se lo preparaba igual.', 'hold');
      else say('La bombilla marca una diagonal hacia el living.', false);
      return;
    }

    if (region.id === 'fridge') {
      audio.current?.playHum(1200, 48);
      unlock('fridge-photo', has('tap-silence') ? 'Sin el goteo se oye la cinta: Beto aparece reflejado en una fuente. Es la primera vez que le ves la cara.' : 'Un pote de helado dice TUCO. Adentro hay tornillos y una foto reflejada a medias.', 'tap');
      return;
    }

    if (region.id === 'box') {
      if (session.get().knowledge.length < 5) return say('Tres casetes tienen la misma etiqueta. El desgaste importa más que la fecha.', false);
      unlock('cassette', 'La tapa abre. “ORIGIN — Malena, 1994”. Tu nombre está escrito con la letra de Beto. La respiración del principio era la tuya, dormido.', 'tap');
      return;
    }

    if (region.id === 'bed') {
      session.discover('bed-indent');
      say(has('cassette') ? 'Bajo la colcha hay una marca rectangular, del tamaño de una cámara chica.' : 'La cama está hecha demasiado prolija para una casa que se vacía.', false);
      return;
    }

    if (region.id === 'bedroom-window') {
      say('En el vidrio se ve el patio. La ropa colgada tapa justo la mitad del reflejo.', false);
      return;
    }

    if (region.id === 'letter') {
      if (gesture !== 'hold') return say('El sobre se dobla, pero no abre.', false);
      if (session.get().knowledge.length < 7) return say('Todavía faltan voces para leer esa nota sin creerle demasiado.', false);
      mark('letter-open', 'hold');
      session.discover('letter','child-voice');
      setPhase('decision');
      session.setDramaticState('decision');
      audio.current?.playHoldSilence();
      say('Malena anotó: “El abuelo filmó para que no olvidáramos. Vos volviste para decidir si también querés aparecer”.', true);
      return;
    }

    if (region.id === 'mirror') {
      session.discover('mirror-gap');
      if (engine.current && canClose(engine.current.get()) && gesture === 'hold') finish('mirror');
      else say(has('cassette') ? 'El espejo devuelve el cuarto con un hueco a la altura del hombro.' : 'El espejo muestra el cuarto sin corregirlo.', false);
    }
  }, [finish, has, mark, move, say, unlock]);

  const inputController = createInputHandlers(active, setActive, input, setInput, sceneRect, resolve);

  if (!started) {
    return (
      <main
        className={styles.entry}
        onClick={() => {
          setStarted(true);
          audio.current?.unlock();
          say('Volvés a la casa de Elvira y Beto antes de que la vacíen. Malena dejó una nota: “buscá la cinta de la final”. La foto del pasillo está torcida.');
        }}
      >
        <span>ORIGIN</span>
        <small>Almagro, última visita</small>
      </main>
    );
  }

  if (ending) {
    return (
      <main className={styles.ending}>
        <p>{ending}</p>
        <button onClick={() => window.location.reload()}>volver a entrar</button>
      </main>
    );
  }

  return (
    <main className={styles.experience} data-phase={phase} data-debug={debug}>
      <NotebookTab pending={engine.current?.get().pendingNotes.length||0} onOpen={()=>setNotebookOpen(true)} />
      {notebookOpen&&engine.current&&<Notebook state={engine.current.get()} onClose={()=>setNotebookOpen(false)} onRead={()=>engine.current?.consumePending()} onRelate={(a,b)=>{engine.current?.relate(a,b);refresh(v=>v+1)}} />}
      <div className={styles.room}>
        <div
          ref={artRef}
          className={styles.art}
          data-scene={scene}
          data-flags={flags}
          data-reading={reading}
          onPointerMove={event => updatePointer(event.clientX, event.clientY)}
          style={{
            backgroundImage: `url(${current.image})`,
            '--light-x': `${input.pointer?.x ?? 500}`,
            '--light-y': `${input.pointer?.y ?? 500}`,
          } as CSSProperties}
        >
          <div className={styles.darkness} />
          <div className={styles.memoryLayer} aria-hidden="true" />
          {scene === 'living' && has('tv-86') && (
            <div className={tv.memory} aria-hidden="true">
              <img src="/tv-mexico-86.png" alt="" />
              <i /><b />
            </div>
          )}
          <div className={styles.dust} aria-hidden="true" />
          {current.regions.map(region => (
            <button
              key={region.id}
              data-hotspot={region.id}
              data-kind={region.kind}
              data-seen={has(region.id) || has(`${region.id}-tuned`) || has(`${region.id}-back`)}
              aria-label={region.label}
              className={`${styles.hotspot} ${effects[region.id] || ''} ${input.activeId === region.id ? styles.holding : ''} ${debug ? styles.debugHotspot : ''}`}
              style={{ ...styleForRegion(region), '--hold': input.activeId === region.id ? input.holdProgress : 0 } as CSSProperties}
              {...inputController.bind(region)}
            >
              {debug && <span>{region.label} · {region.kind}</span>}
            </button>
          ))}
          {message && <div className={styles.caption} aria-live="polite">{message}</div>}
          {debug && (
            <>
              <svg className={styles.debugMap} viewBox="0 0 1000 1000" aria-hidden="true">
                {current.regions.map(region => (
                  <g key={region.id}>
                    <rect x={region.rect.x} y={region.rect.y} width={region.rect.w} height={region.rect.h} />
                    <text x={region.rect.x + 8} y={region.rect.y + 18}>{region.id} · {region.kind}</text>
                  </g>
                ))}
                {input.pointer && <circle cx={input.pointer.x} cy={input.pointer.y} r="6" />}
              </svg>
              <output className={styles.debug}>
                {JSON.stringify({
                  scene,
                  sceneSize: current.size,
                  renderedRect,
                  pointer: input.pointer && { x: Math.round(input.pointer.x), y: Math.round(input.pointer.y) },
                  phase,
                  flags,
                  reading,
                  behavior,
                  knowledge: engine.current?.get().knowledge,
                  hypotheses: engine.current?.get().hypotheses,
                  relations: engine.current?.get().relations,
                  lastAction: behavior?.lastActionAt,
                  pendingNotebook: engine.current?.get().pendingNotes,
                  worldChanges: engine.current?.get().worldChanges,
                }, null, 1)}
              </output>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
