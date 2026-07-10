'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import { CSSProperties, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { SessionEngine } from '../engine/memory';
import { DramaticState, Scene } from '../engine/types';
import styles from '../styles/experience.module.css';
import effects from '../styles/effects.module.css';

type Hotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  holdable?: boolean;
  draggable?: boolean;
};

const spots: Record<Scene, Hotspot[]> = {
  hallway: [
    { id: 'lamp', label: 'aplique del pasillo', x: 68, y: 18, w: 13, h: 16 },
    { id: 'photo', label: 'foto de la abuela Elvira', x: 4, y: 52, w: 21, h: 20, holdable: true },
    { id: 'door-living', label: 'puerta al living', x: 10, y: 14, w: 24, h: 52 },
    { id: 'door-kitchen', label: 'puerta a la cocina', x: 60, y: 33, w: 14, h: 42 },
    { id: 'door-bedroom', label: 'puerta al cuarto de los nietos', x: 87, y: 8, w: 13, h: 84 },
    { id: 'exit', label: 'puerta de calle', x: 50, y: 37, w: 16, h: 31 },
  ],
  living: [
    { id: 'television', label: 'televisor: final del 86', x: 55, y: 34, w: 21, h: 27 },
    { id: 'chair', label: 'sillon de la abuela', x: 4, y: 43, w: 40, h: 39 },
    { id: 'radio', label: 'radio Spica: arrastra la perilla', x: 78, y: 39, w: 19, h: 17, draggable: true },
    { id: 'living-window', label: 'ventana a Buenos Aires', x: 10, y: 8, w: 40, h: 32 },
  ],
  kitchen: [
    { id: 'tap', label: 'canilla que gotea', x: 38, y: 40, w: 12, h: 10, holdable: true },
    { id: 'mate', label: 'mate de Elvira', x: 19, y: 62, w: 13, h: 16, holdable: true },
    { id: 'fridge', label: 'heladera Siam', x: 78, y: 28, w: 19, h: 58 },
    { id: 'kettle', label: 'pava y hornalla', x: 52, y: 42, w: 16, h: 15 },
    { id: 'family-photos', label: 'fotos familiares', x: 3, y: 7, w: 19, h: 22 },
  ],
  bedroom: [
    { id: 'letter', label: 'sobre de Malena: mantenelo', x: 57, y: 72, w: 11, h: 7, holdable: true },
    { id: 'bedroom-window', label: 'ventana al patio', x: 90, y: 16, w: 10, h: 43 },
    { id: 'mirror', label: 'espejo del ropero', x: 58, y: 20, w: 17, h: 40, holdable: true },
    { id: 'box', label: 'caja de casetes y fotos', x: 54, y: 62, w: 27, h: 19 },
    { id: 'bed', label: 'cama de los primos', x: 3, y: 34, w: 44, h: 50 },
  ],
};

const position = (spot: Hotspot): CSSProperties => ({
  left: `${spot.x}%`,
  top: `${spot.y}%`,
  width: `${spot.w}%`,
  height: `${spot.h}%`,
});

export default function Experience() {
  const engine = useRef<SessionEngine | null>(null);
  const audio = useRef<AudioEngine | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const dragStartX = useRef(0);
  const dragTriggered = useRef(false);

  const [started, setStarted] = useState(false);
  const [scene, setScene] = useState<Scene>('hallway');
  const [phase, setPhase] = useState<DramaticState>('threshold');
  const [message, setMessage] = useState('');
  const [held, setHeld] = useState<string | null>(null);
  const [ending, setEnding] = useState<'leave' | 'stay' | null>(null);
  const [debug, setDebug] = useState(false);
  const [searchAwake, setSearchAwake] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    engine.current = new SessionEngine();
    audio.current = new AudioEngine();
    setDebug(new URLSearchParams(window.location.search).has('debug'));
    const onVisibility = () => {
      if (document.hidden) engine.current?.hide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      audio.current?.destroy();
    };
  }, []);

  const has = useCallback((id: string) => Boolean(engine.current?.has(id)), []);

  const say = useCallback((text: string) => {
    setMessage(text);
    audio.current?.speak(text);
    window.setTimeout(() => setMessage(current => current === text ? '' : current), 6400);
  }, []);

  const mark = useCallback((id: string, gesture: 'click' | 'hold' = 'click') => {
    engine.current?.act(id, gesture, scene);
    audio.current?.setRoomToneIntensity(Math.min(6, Object.keys(engine.current?.get().behavior.objectVisits || {}).length));
    rerender(value => value + 1);
  }, [scene]);

  const move = useCallback((next: Scene, text: string) => {
    engine.current?.visit(next);
    setScene(next);
    rerender(value => value + 1);
    audio.current?.playCreak();
    audio.current?.playSceneAmbient(next);
    say(text);
  }, [say]);

  const finish = useCallback((kind: 'leave' | 'stay') => {
    engine.current?.setDramaticState('consequence');
    setPhase('consequence');
    setEnding(kind);
    if (kind === 'leave') audio.current?.playDoorSlam();
    else audio.current?.playHeartbeat(5000);
  }, []);

  const resolve = useCallback((id: string, gesture: 'click' | 'hold' | 'drag' = 'click') => {
    const session = engine.current;
    if (!session) return;
    audio.current?.unlock();
    const memoryId = id === 'photo' && gesture === 'hold' ? 'photo-back' :
      id === 'radio' && gesture === 'drag' ? 'radio-tuned' :
      id === 'letter' && gesture === 'hold' ? 'letter-open' :
      id === 'television' && session.has('radio-tuned') ? 'tv-86' :
      id;
    mark(memoryId, gesture === 'click' ? 'click' : 'hold');

    if (id === 'door-living') return move('living', 'Entrás al living de la abuela Elvira. Afuera llueve sobre Almagro; adentro, la tele espera el gol.');
    if (id === 'door-kitchen') return move('kitchen', 'Entrás a la cocina. Huele a pava vieja, repasador húmedo y domingo de familia.');
    if (id === 'door-bedroom') return move('bedroom', 'Entrás al cuarto de los nietos. Malena dejó una caja abierta y una carta sin terminar.');
    if (id === 'exit') {
      if (phase === 'decision') finish('leave');
      else say(searchAwake ? 'La calle queda al fondo, pero todavía no sabés qué pasó con quien filmó el 86.' : 'La puerta da a Buenos Aires. La casa, por ahora, no te suelta.');
      return;
    }

    if (id === 'photo') {
      if (gesture === 'hold') {
        setSearchAwake(true);
        setPhase('recognition');
        session.setDramaticState('recognition');
        audio.current?.playPaperRustle();
        say('Atrás de la foto dice: Elvira, Tito, Malena, Diego en la tele. Al que grabó no lo nombran. La firma está raspada.');
      } else {
        say(session.has('photo-back') ? 'Todos miran al lente. Nadie mira a la persona que sostiene la cámara.' : 'El marco está flojo. Mantenelo apretado para mirar el reverso.');
      }
      return;
    }

    if (id === 'lamp') {
      audio.current?.playKnock();
      say(session.has('photo-back') ? 'La luz encuentra una marca rectangular en la pared: acá colgaba una foto que alguien sacó.' : 'El aplique parpadea como si la casa respirara detrás del papel floreado.');
      return;
    }

    if (id === 'television') {
      audio.current?.playTVStatic(session.has('radio-tuned') ? 0.7 : 0.3, 1800);
      if (session.has('radio-tuned')) {
        setPhase('confrontation');
        session.setDramaticState('confrontation');
        say('La pantalla agarra señal: México 86. El living se llena de gritos, bocinazos y una voz que dice: dale, filmá a la abuela cuando termine el partido.');
      } else {
        say('La tele quiere mostrar el partido, pero la señal se desarma. Quizá la radio todavía tenga la frecuencia de ese día.');
      }
      return;
    }

    if (id === 'chair') {
      say(session.has('tv-86') ? 'En el sillón, Elvira aplaudió el segundo gol y se tapó la cara cuando todos empezaron a llorar.' : 'El sillón guarda la forma de una abuela mirando la tele con el mate entre las manos.');
      return;
    }

    if (id === 'radio') {
      if (gesture === 'drag') {
        audio.current?.playTVStatic(0.45, 1800);
        setSearchAwake(true);
        say('La Spica encuentra a Victor Hugo y después otra voz, casera: Beto, dejá de filmar el televisor y vení a la foto.');
      } else {
        audio.current?.playStaticZap();
        say('La perilla raspa. Arrastrala: no está rota, está desintonizada.');
      }
      return;
    }

    if (id === 'living-window') {
      say(session.has('tv-86') ? 'Por la ventana suben bocinazos de 1986. Buenos Aires festeja, pero Beto sigue detrás de cámara.' : 'La lluvia contra la persiana suena como una cinta rebobinando.');
      return;
    }

    if (id === 'tap') {
      audio.current?.playDrip();
      say(gesture === 'hold' ? 'Cortás la canilla y el silencio deja oír una cinta: Elvira dice que nadie se queda afuera de una foto familiar.' : 'La canilla gotea con paciencia de casa vieja. Mantenela si querés cortar el ruido.');
      return;
    }

    if (id === 'mate') {
      say(gesture === 'hold' ? 'El mate todavía tiene calor. Elvira lo dejó para llamar a Beto desde la cocina.' : 'La bombilla apunta hacia el living, como una brújula doméstica.');
      return;
    }

    if (id === 'fridge') {
      audio.current?.playHum(1400, 52);
      say('La heladera vibra y se apaga. No cambia de habitación: sólo guarda imanes de Mar del Plata, una boleta de SEGBA y una foto arrancada.');
      return;
    }

    if (id === 'kettle') {
      say(session.has('mate') ? 'La hornalla baja sola. La pava deja de temblar cuando el mate vuelve a su lugar.' : 'El fueguito azul insiste bajo la pava. Algo en esta cocina quedó esperando.');
      return;
    }

    if (id === 'family-photos') {
      setSearchAwake(true);
      say(session.has('photo-back') ? 'Mismo living, misma abuela, distintos años. Siempre falta Beto: no desapareció, quedó condenado a mirar por el lente.' : 'En las fotos están Elvira, Tito y Malena. Falta el hijo que siempre sacaba la foto.');
      return;
    }

    if (id === 'box') {
      say(session.has('tv-86') ? 'En la caja hay un casete rotulado: Final 86, casa de mamá. Abajo, una Polaroid en blanco espera revelarse.' : 'La caja tiene casetes, fotos boca abajo y una etiqueta: no abrir hasta que vuelva la señal.');
      return;
    }

    if (id === 'bed') {
      say('La cama de los primos conserva un secreto simple: todos crecieron, menos la tarde que la familia siguió repitiendo.');
      return;
    }

    if (id === 'bedroom-window') {
      say('En el vidrio aparece el patio de una casa chorizo, ropa colgada y una cámara apoyada contra tu pecho.');
      return;
    }

    if (id === 'letter') {
      if (gesture !== 'hold') {
        say('El sobre no tiene nombre. Mantenelo para abrirlo sin romperlo.');
        return;
      }
      const ready = session.has('photo-back') && session.has('radio-tuned') && session.has('family-photos') && session.has('tv-86');
      if (!ready) {
        say(!session.has('photo-back') ? 'El papel está en blanco. El reverso de la foto del pasillo conserva el primer dato.' :
          !session.has('radio-tuned') ? 'Sólo se lee: buscá la voz en la Spica del living.' :
          !session.has('tv-86') ? 'Sólo se lee: cuando vuelva el partido, la casa va a recordar.' :
          'La última línea señala las fotos de la cocina.');
        return;
      }
      setPhase('decision');
      session.setDramaticState('decision');
      audio.current?.playHoldSilence();
      say('Malena escribió: Beto, si seguís detrás de cámara, la casa te repite. Si querés aparecer, dejá de mirar y entrá al espejo.');
      return;
    }

    if (id === 'mirror') {
      if (gesture === 'hold' && phase === 'decision') {
        finish('stay');
        return;
      }
      say(phase === 'decision' ? 'Tu reflejo ya no esquiva la mirada. Mantené la mano sobre el espejo.' : 'El espejo muestra el cuarto, pero todavía no muestra a Beto.');
    }
  }, [finish, mark, move, phase, say, searchAwake]);

  const cancelGesture = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdTriggered.current = false;
    dragTriggered.current = false;
    setHeld(null);
  };

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, spot: Hotspot) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdTriggered.current = false;
    dragTriggered.current = false;
    dragStartX.current = event.clientX;
    if (!spot.holdable && !spot.draggable) return;
    setHeld(spot.id);
    if (spot.holdable) {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        holdTriggered.current = true;
        setHeld(null);
        resolve(spot.id, 'hold');
      }, 850);
    }
  };

  const pointerMove = (event: PointerEvent<HTMLButtonElement>, spot: Hotspot) => {
    if (!spot.draggable || dragTriggered.current) return;
    if (Math.abs(event.clientX - dragStartX.current) > 30) {
      dragTriggered.current = true;
      setHeld(null);
      resolve(spot.id, 'drag');
    }
  };

  const pointerUp = (spot: Hotspot) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeld(null);
    if (!holdTriggered.current && !dragTriggered.current) resolve(spot.id, 'click');
    holdTriggered.current = false;
    dragTriggered.current = false;
  };

  const visits = engine.current?.get().behavior.objectVisits || {};
  const flags = Object.keys(visits).join(' ');
  const conclusion = ending === 'leave'
    ? 'Saliste a Buenos Aires con la caja bajo el brazo. En la foto nueva seguís sin aparecer, pero ahora todos saben quién miraba desde atrás.'
    : 'Apoyaste la cámara. La Polaroid tardó en revelarse y, por primera vez, Elvira, Malena, Tito y Beto quedaron dentro de la misma imagen.';

  if (!started) {
    return (
      <main
        className={styles.entry}
        onClick={() => {
          setStarted(true);
          audio.current?.unlock();
          say('Buenos Aires, casa de la abuela Elvira. Hay alguien que nunca aparece en las fotos. Empezá por el retrato del pasillo.');
        }}
      >
        <span>ORIGIN</span>
        <small>casa Elvira, Almagro, 1986</small>
      </main>
    );
  }

  if (ending) {
    return (
      <main className={styles.ending}>
        <p>{conclusion}</p>
        <button onClick={() => window.location.reload()}>volver a entrar</button>
      </main>
    );
  }

  return (
    <main className={styles.experience} data-phase={phase}>
      <div className={styles.room}>
        <div
          className={styles.art}
          data-scene={scene}
          data-flags={flags}
          style={{
            backgroundImage: `url(/bg-${scene}.png)`,
            filter: searchAwake ? 'sepia(.12) saturate(1.12) brightness(1.04)' : undefined,
            transition: 'filter 1.6s ease',
          }}
        >
          <div className={styles.darkness} />
          <div className={styles.memoryLayer} aria-hidden="true" />
          {spots[scene].map(spot => (
            <button
              key={spot.id}
              data-hotspot={spot.id}
              data-seen={has(spot.id) || has(`${spot.id}-tuned`) || has(`${spot.id}-back`)}
              data-memory={spot.id === 'television' && has('tv-86') ? 'true' : undefined}
              aria-label={spot.label}
              className={`${styles.hotspot} ${effects[spot.id] || ''} ${held === spot.id ? styles.holding : ''} ${debug ? styles.debugHotspot : ''}`}
              style={position(spot)}
              onPointerDown={event => pointerDown(event, spot)}
              onPointerMove={event => pointerMove(event, spot)}
              onPointerUp={() => pointerUp(spot)}
              onPointerCancel={cancelGesture}
              onPointerLeave={() => {
                if (held === spot.id) cancelGesture();
              }}
            >
              <span>{spot.label}</span>
            </button>
          ))}
          {scene !== 'hallway' && (
            <button
              className={styles.back}
              aria-label="volver al pasillo"
              onClick={() => move('hallway', phase === 'decision' ? 'Volvés al pasillo. La puerta de calle y el espejo ya significan cosas distintas.' : 'Volvés al pasillo.')}
            >
              ← pasillo
            </button>
          )}
          <div className={styles.caption} aria-live="polite">{message}</div>
          {searchAwake && phase !== 'decision' && (
            <p className={styles.question}>¿Quién fue Beto cuando todos miraban a cámara?</p>
          )}
          <p className={styles.sceneName}>{scene === 'hallway' ? 'pasillo' : scene === 'living' ? 'living' : scene === 'kitchen' ? 'cocina' : 'cuarto'}</p>
          {debug && (
            <output className={styles.debug}>
              {JSON.stringify({ phase, flags, behavior: engine.current?.get().behavior, readings: engine.current?.get().readings.slice(-3) }, null, 1)}
            </output>
          )}
        </div>
      </div>
    </main>
  );
}
