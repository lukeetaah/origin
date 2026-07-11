'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, @next/next/no-img-element */
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { closingText, coreSequence, isCompleteEnoughForLetter, nextPhysicalPrompt, sceneEntryLine } from '../engine/drama';
import { createInputHandlers, Gesture, InputSnapshot } from '../engine/input';
import { SessionEngine } from '../engine/memory';
import { Region, scenes, styleForRegion } from '../engine/scenes';
import { DramaticState, Scene } from '../engine/types';
import effects from '../styles/effects.module.css';
import styles from '../styles/experience.module.css';
import tv from '../styles/tv.module.css';

type ActivePress = Parameters<typeof createInputHandlers>[0];

export default function Experience() {
  const engine = useRef<SessionEngine | null>(null);
  const audio = useRef<AudioEngine | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const pointerResolvedAt = useRef(0);
  const [started, setStarted] = useState(false);
  const [scene, setScene] = useState<Scene>('hallway');
  const [phase, setPhase] = useState<DramaticState>('threshold');
  const [message, setMessage] = useState('');
  const [ending, setEnding] = useState<'leave' | 'mirror' | null>(null);
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
  const complete = coreSequence.every(id => Boolean(visits[id]));
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

  const finish = useCallback((kind: 'leave' | 'mirror') => {
    engine.current?.setDramaticState('consequence');
    setPhase('consequence');
    setEnding(kind);
    if (kind === 'leave') audio.current?.playDoorSlam();
    else audio.current?.playHeartbeat(4200);
  }, []);

  const resolve = useCallback((region: Region, gesture: Gesture) => {
    pointerResolvedAt.current = Date.now();
    const session = engine.current;
    if (!session) return;
    audio.current?.unlock();

    if (region.kind === 'exit') {
      if (region.id === 'exit') {
        if (phase === 'decision') finish('leave');
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
      if (!has('radio-tuned')) {
        say('La imagen sube y cae. Falta la radio.', false);
        return;
      }
      setPhase('confrontation');
      session.setDramaticState('confrontation');
      audio.current?.playWorldCupMemory();
      unlock('tv-86', 'México, 1986. Burruchaga corre. Elvira vuelca el mate. Malena salta sobre el sillón. Beto no aparece: detrás de la cámara dice “ahora sí, ahora estamos todos”.', 'tap');
      return;
    }

    if (region.id === 'chair') {
      if (has('tv-86')) unlock('elvira-place', 'En el tapizado quedó el círculo del mate de Elvira. La silla apunta a la cocina porque fue a buscar otra bandera.', 'tap');
      else say('El sillón mira la tele como si todavía faltaran seis minutos para ser campeones.', false);
      return;
    }

    if (region.id === 'living-window') {
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
      if (has('mate-warm')) unlock('kettle-low', 'Bajás la llama como hacía Elvira. El vapor revela en el azulejo: B + E, 1958.', 'tap');
      else say('La pava no hierve: espera.', false);
      return;
    }

    if (region.id === 'mate') {
      if (has('tap-silence') && has('mate-warm') && has('kettle-low') && !has('table-set')) {
        unlock('table-set', 'Ponés el mate frente al lugar vacío. Por un segundo la silla cruje bajo el peso de Elvira.', 'hold');
        return;
      }
      if (gesture === 'hold') unlock('mate-warm', 'La yerba conserva el perfume de cedrón de Elvira. Malena lo odiaba; Beto se lo preparaba igual.', 'hold');
      else say('La bombilla marca una diagonal hacia el living.', false);
      return;
    }

    if (region.id === 'fridge') {
      audio.current?.playHum(1200, 48);
      if (has('tap-silence')) unlock('fridge-photo', 'Bajo el imán de Mar del Plata aparece Beto, reflejado en una fuente. Es la primera vez que le ves la cara.', 'tap');
      else say('La heladera vibra. Los imanes no se mueven.', false);
      return;
    }

    if (region.id === 'box') {
      if (!has('tv-86')) return say('La etiqueta dice FINAL 86, pero la cinta no arranca sin la tele.', false);
      if (!has('elvira-place')) return say('La caja se traba. Falta saber quién estaba mirando la mesa.', false);
      if (!has('family-photos')) return say('La caja cede un dedo. Las fotos todavía no explican hacia dónde miran.', false);
      if (!has('table-set')) return say('La caja golpea contra la madera. La cocina todavía no cerró.', false);
      unlock('cassette', 'La tapa abre. “ORIGIN — Malena, 1994”. Tu nombre está escrito con la letra de Beto. La respiración del principio era la tuya, dormido.', 'tap');
      return;
    }

    if (region.id === 'bed') {
      say(has('cassette') ? 'Bajo la colcha hay una marca rectangular, del tamaño de una cámara chica.' : 'La cama está hecha demasiado prolija para una casa que se vacía.', false);
      return;
    }

    if (region.id === 'bedroom-window') {
      say('En el vidrio se ve el patio. La ropa colgada tapa justo la mitad del reflejo.', false);
      return;
    }

    if (region.id === 'letter') {
      if (gesture !== 'hold') return say('El sobre se dobla, pero no abre.', false);
      if (!isCompleteEnoughForLetter(has)) return say(nextPhysicalPrompt(has), false);
      mark('letter-open', 'hold');
      setPhase('decision');
      session.setDramaticState('decision');
      audio.current?.playHoldSilence();
      say('Malena anotó: “El abuelo filmó para que no olvidáramos. Vos volviste para decidir si también querés aparecer”.', true);
      return;
    }

    if (region.id === 'mirror') {
      if (phase === 'decision') finish('mirror');
      else say(has('cassette') ? 'El espejo devuelve el cuarto con un hueco a la altura del hombro.' : 'El espejo muestra el cuarto sin corregirlo.', false);
    }
  }, [finish, has, mark, move, phase, say, unlock]);

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
        <p>{closingText(ending, complete)}</p>
        <button onClick={() => window.location.reload()}>volver a entrar</button>
      </main>
    );
  }

  return (
    <main className={styles.experience} data-phase={phase} data-debug={debug}>
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
              onClick={event => {
                event.preventDefault();
                if (Date.now() - pointerResolvedAt.current < 250) return;
                if (region.kind === 'hold' || region.kind === 'drag') return;
                resolve(region, 'tap');
              }}
              onMouseUp={event => {
                event.preventDefault();
                if (Date.now() - pointerResolvedAt.current < 250) return;
                if (region.kind === 'hold' || region.kind === 'drag') return;
                resolve(region, 'tap');
              }}
              onTouchEnd={event => {
                event.preventDefault();
                if (Date.now() - pointerResolvedAt.current < 250) return;
                if (region.kind === 'hold' || region.kind === 'drag') return;
                resolve(region, 'tap');
              }}
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
                }, null, 1)}
              </output>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
