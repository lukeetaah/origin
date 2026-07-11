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

type Clue = {
  id: string;
  label: string;
  hint: string;
};

const spots: Record<Scene, Hotspot[]> = {
  hallway: [
    { id: 'lamp', label: 'aplique del pasillo', x: 68, y: 18, w: 13, h: 16 },
    { id: 'photo', label: 'foto de Elvira: mantener', x: 4, y: 52, w: 21, h: 20, holdable: true },
    { id: 'door-living', label: 'puerta al living', x: 10, y: 14, w: 24, h: 52 },
    { id: 'door-kitchen', label: 'puerta a la cocina', x: 60, y: 33, w: 14, h: 42 },
    { id: 'door-bedroom', label: 'puerta al cuarto', x: 87, y: 8, w: 13, h: 84 },
    { id: 'exit', label: 'puerta de calle', x: 50, y: 37, w: 16, h: 31 },
  ],
  living: [
    { id: 'television', label: 'televisor: final del 86', x: 55, y: 34, w: 21, h: 27 },
    { id: 'chair', label: 'sillon de Elvira', x: 4, y: 43, w: 40, h: 39 },
    { id: 'radio', label: 'radio Spica: arrastrar', x: 78, y: 39, w: 19, h: 17, draggable: true },
    { id: 'living-window', label: 'ventana a Almagro', x: 10, y: 8, w: 40, h: 32 },
  ],
  kitchen: [
    { id: 'tap', label: 'canilla: mantener', x: 38, y: 40, w: 12, h: 10, holdable: true },
    { id: 'mate', label: 'mate de Elvira: mantener', x: 19, y: 62, w: 13, h: 16, holdable: true },
    { id: 'fridge', label: 'heladera Siam', x: 78, y: 28, w: 19, h: 58 },
    { id: 'kettle', label: 'pava y hornalla', x: 52, y: 42, w: 16, h: 15 },
    { id: 'family-photos', label: 'fotos familiares', x: 3, y: 7, w: 19, h: 22 },
  ],
  bedroom: [
    { id: 'letter', label: 'sobre de Malena: mantener', x: 57, y: 72, w: 11, h: 7, holdable: true },
    { id: 'bedroom-window', label: 'ventana al patio', x: 90, y: 16, w: 10, h: 43 },
    { id: 'mirror', label: 'espejo del ropero: mantener', x: 58, y: 20, w: 17, h: 40, holdable: true },
    { id: 'box', label: 'caja de casetes', x: 54, y: 62, w: 27, h: 19 },
    { id: 'bed', label: 'cama de los primos', x: 3, y: 34, w: 44, h: 50 },
  ],
};

const clues: Clue[] = [
  { id: 'photo-back', label: 'reverso', hint: 'Mira la foto del pasillo: ahi empieza el faltante.' },
  { id: 'radio-tuned', label: 'voz', hint: 'La Spica guarda la frecuencia de la tarde.' },
  { id: 'tv-86', label: 'partido', hint: 'La tele necesita la radio para volver al 86.' },
  { id: 'family-photos', label: 'fotos', hint: 'En la cocina falta siempre la misma persona.' },
  { id: 'tap-silence', label: 'silencio', hint: 'La canilla tapa una frase de Elvira.' },
  { id: 'mate-warm', label: 'mate', hint: 'El mate marca quien dejo la ronda.' },
  { id: 'cassette', label: 'casete', hint: 'La caja del cuarto se abre cuando vuelve el partido.' },
  { id: 'letter-open', label: 'carta', hint: 'Abri la carta de Malena y elegi que hacer con Beto.' },
];

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
  const pointerHandled = useRef(false);

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

  const visits = engine.current?.get().behavior.objectVisits || {};
  const flags = Object.keys(visits).join(' ');
  const unlockedClues = clues.filter(clue => Boolean(visits[clue.id]));
  const nextClue = clues.find(clue => !visits[clue.id]);
  const progress = Math.round((unlockedClues.length / clues.length) * 100);

  const has = useCallback((id: string) => Boolean(engine.current?.has(id)), []);

  const say = useCallback((text: string) => {
    setMessage(text);
    audio.current?.speak(text);
    window.setTimeout(() => setMessage(current => current === text ? '' : current), 7000);
  }, []);

  const mark = useCallback((id: string, gesture: 'click' | 'hold' = 'click') => {
    engine.current?.act(id, gesture, scene);
    audio.current?.setRoomToneIntensity(Math.min(7, Object.keys(engine.current?.get().behavior.objectVisits || {}).length));
    rerender(value => value + 1);
  }, [scene]);

  const unlock = useCallback((id: string, text: string) => {
    if (!engine.current?.has(id)) {
      mark(id, 'hold');
      audio.current?.playMemoryUnlock();
    }
    setSearchAwake(true);
    say(text);
  }, [mark, say]);

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

  const readyForLetter = ['radio-tuned', 'tv-86', 'family-photos', 'cassette']
    .every(id => Boolean(visits[id]));
  const letterOpen = Boolean(visits['letter-open']);
  const currentHint = phase === 'decision' ? 'Final: puerta o espejo.' :
    readyForLetter && !letterOpen ? 'Abri la carta de Malena: ya tenes lo necesario.' :
      nextClue?.hint;

  const resolve = useCallback((id: string, gesture: 'click' | 'hold' | 'drag' = 'click') => {
    const session = engine.current;
    if (!session) return;
    audio.current?.unlock();

    if (id === 'door-living') return move('living', 'Entras al living de Elvira. La casa baja la voz: aca se grito el mundial y despues nadie supo donde poner la camara.');
    if (id === 'door-kitchen') return move('kitchen', 'Entras a la cocina. La hornalla esta viva, la canilla marca el pulso y el mate todavia parece de alguien.');
    if (id === 'door-bedroom') return move('bedroom', 'Entras al cuarto de los primos. Malena dejo el lugar como una mesa de investigacion: casetes, fotos, una carta.');
    if (id === 'exit') {
      if (phase === 'decision') finish('leave');
      else {
        audio.current?.playLocked();
        say(readyForLetter ? 'Podes salir cuando entiendas para que. Falta abrir la carta de Malena: ahi te dice que llevarte de esta casa.' : `La calle esta ahi, pero salir sin historia es solo mudarse de pantalla. Pista pendiente: ${currentHint || 'busca en el cuarto'}`);
      }
      return;
    }

    if (id === 'photo') {
      if (gesture === 'hold') {
        setPhase('recognition');
        session.setDramaticState('recognition');
        audio.current?.playPaperRustle();
        return unlock('photo-back', 'Das vuelta la foto. Atras dice: Elvira, Tito, Malena, Diego en la tele. Donde deberia decir Beto, el papel esta raspado.');
      }
      if (!session.has('photo-back')) return unlock('photo-back', 'El marco se abre con un crack chiquito. Atras hay una lista de nombres y uno raspado: Beto.');
      say('Ahora sabes que no falta una cara: falta quien estaba detras del lente.');
      return;
    }

    if (id === 'lamp') {
      audio.current?.playKnock();
      if (session.has('photo-back')) unlock('wall-mark', 'La luz revela un rectangulo mas claro en la pared. Alguien saco una foto de aca para que nadie preguntara por Beto.');
      else say('El aplique parpadea sobre la foto, como si quisiera que la des vuelta.');
      return;
    }

    if (id === 'radio') {
      if (gesture === 'drag') {
        setPhase('confrontation');
        audio.current?.playTVStatic(0.45, 1800);
        return unlock('radio-tuned', 'La Spica engancha una transmision: Victor Hugo se mezcla con una voz de familia. Beto, deja de filmar el televisor y veni a la foto, que Elvira ya esta posando.');
      }
      audio.current?.playStaticZap();
      say('La perilla no se clickea: se arrastra. Tiene una frecuencia escondida, como las radios de antes.');
      return;
    }

    if (id === 'television') {
      audio.current?.playTVStatic(session.has('radio-tuned') ? 0.7 : 0.3, 1800);
      if (!session.has('radio-tuned')) {
        say('La tele intenta mostrar Mexico 86, pero la senal se rompe. Primero sintoniza la radio.');
        return;
      }
      session.setDramaticState('confrontation');
      setPhase('confrontation');
      return unlock('tv-86', 'La pantalla entra en foco: Argentina campeon. El living vibra, Elvira llora, Tito golpea la mesa, un vecino grita desde el pulmon del edificio, y Beto sigue filmando.');
    }

    if (id === 'chair') {
      if (session.has('tv-86')) unlock('elvira-place', 'En el sillon aparece por un segundo Elvira: no fantasma, recuerdo. Senala la cocina y tira un “nene, el mate no se abandona” con autoridad de cadena nacional.');
      else say('El sillon tiene la forma de Elvira: espalda chica, manta pesada, ojos clavados en la tele y paciencia cero para los distraidos.');
      return;
    }

    if (id === 'living-window') {
      say(session.has('tv-86') ? 'Afuera Buenos Aires toca bocina. Adentro, nadie nota que el que guarda el recuerdo se queda afuera.' : 'La lluvia sobre la persiana suena como cinta rebobinando.');
      return;
    }

    if (id === 'tap') {
      audio.current?.playDrip();
      if (gesture === 'hold' || !session.has('tap-silence')) return unlock('tap-silence', 'Cortas la canilla. En el silencio se oye a Elvira: en esta casa nadie se queda afuera de la mesa.');
      say('La canilla ya no tapa la frase. La cocina respira mejor.');
      return;
    }

    if (id === 'mate') {
      if (gesture === 'hold' || !session.has('mate-warm')) return unlock('mate-warm', 'El mate esta tibio. Elvira lo dejo en la cocina para ir a buscar a Beto al living.');
      say('La bombilla apunta hacia la tele. No es decoracion: es una flecha domestica.');
      return;
    }

    if (id === 'fridge') {
      audio.current?.playHum(1400, 52);
      if (session.has('tap-silence')) unlock('fridge-photo', 'La heladera deja de vibrar. Bajo un iman de Mar del Plata aparece media foto: una mano sosteniendo una camara.');
      else say('La heladera Siam vibra con imanes viejos. No es una puerta: es archivo familiar con motor.');
      return;
    }

    if (id === 'kettle') {
      if (session.has('mate-warm')) unlock('kettle-low', 'Bajas el fuego. La pava deja de temblar y la cocina por fin suena como una casa, no como una alarma.');
      else say('El fuego azul esta demasiado vivo. Capaz el mate te diga por que nadie lo apago.');
      return;
    }

    if (id === 'family-photos') {
      return unlock('family-photos', session.has('photo-back') ?
        'Ordenas las fotos por anio. En todas falta Beto. No desaparecio: era el que hacia existir a los demas.' :
        'Elvira, Tito, Malena, primos, vecinos. Una familia entera mira al mismo punto, y ese punto no aparece.');
    }

    if (id === 'box') {
      if (!session.has('tv-86')) {
        say('La caja no cede. La etiqueta dice: abrir cuando vuelva el partido.');
        return;
      }
      if (!session.has('family-photos')) {
        say('La caja se abre un poco, pero las fotos de la cocina todavia no te dieron el patron.');
        return;
      }
      return unlock('cassette', 'Abres la caja. Hay un casete: FINAL 86 - CASA DE MAMA. Adentro suena una frase cortada: Beto, ahora vos tambien.');
    }

    if (id === 'bed') {
      say(session.has('cassette') ? 'Bajo la colcha hay marcas de rodillas: Malena escucho el casete aca hasta gastarlo.' : 'La cama de los primos no da miedo. Da algo peor: la certeza de una tarde que no termino.');
      return;
    }

    if (id === 'bedroom-window') {
      say('En el vidrio se refleja un patio de casa chorizo, ropa colgada, baldosas mojadas y una camara apoyada contra tu pecho.');
      return;
    }

    if (id === 'letter') {
      const canOpenLetter = ['radio-tuned', 'tv-86', 'family-photos', 'cassette'].every(clueId => session.has(clueId));
      if (!canOpenLetter) {
        say(`La carta se resiste. Falta una pieza central: ${currentHint || 'la caja del cuarto'}`);
        return;
      }
      mark('letter-open', 'hold');
      setPhase('decision');
      session.setDramaticState('decision');
      audio.current?.playHoldSilence();
      say('Malena escribio: Beto, ya encontre tus cintas. Podes salir y contar quien miro por todos, o dejar la camara y aparecer. Elegi: puerta o espejo.');
      return;
    }

    if (id === 'mirror') {
      if (phase === 'decision') {
        finish('stay');
        return;
      }
      say('El espejo todavia muestra el cuarto sin Beto. Primero reconstruye la tarde completa.');
    }
  }, [currentHint, finish, mark, move, phase, readyForLetter, say, unlock]);

  const cancelGesture = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdTriggered.current = false;
    dragTriggered.current = false;
    setHeld(null);
  };

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, spot: Hotspot) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerHandled.current = false;
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
      }, 700);
    }
  };

  const pointerMove = (event: PointerEvent<HTMLButtonElement>, spot: Hotspot) => {
    if (!spot.draggable || dragTriggered.current) return;
    if (Math.abs(event.clientX - dragStartX.current) > 24) {
      dragTriggered.current = true;
      setHeld(null);
      resolve(spot.id, 'drag');
    }
  };

  const pointerUp = (spot: Hotspot) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeld(null);
    pointerHandled.current = true;
    window.setTimeout(() => {
      pointerHandled.current = false;
    }, 0);
    if (!holdTriggered.current && !dragTriggered.current) resolve(spot.id, 'click');
    holdTriggered.current = false;
    dragTriggered.current = false;
  };

  const clickFallback = (spot: Hotspot) => {
    if (pointerHandled.current) return;
    if (spot.draggable) return;
    resolve(spot.id, 'click');
  };

  const conclusion = ending === 'leave'
    ? 'Saliste a Buenos Aires con la caja bajo el brazo. Malena va a escuchar la cinta. Beto no aparece en la foto, pero ya no es ausencia: es autor, testigo y deuda familiar.'
    : 'Apoyaste la camara. La Polaroid tardo en revelarse y, por primera vez, Elvira, Tito, Malena y Beto quedaron dentro de la misma imagen.';

  if (!started) {
    return (
      <main
        className={styles.entry}
        onClick={() => {
          setStarted(true);
          audio.current?.unlock();
          say('Buenos Aires, casa de la abuela Elvira. Hay alguien que nunca aparece en las fotos. Empeza por el retrato del pasillo.');
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
          <aside className={styles.caseboard} aria-label="pistas encontradas">
            <p>{progress}%</p>
            <small>{currentHint}</small>
            <ol>
              {clues.map(clue => (
                <li key={clue.id} data-found={Boolean(visits[clue.id])}>
                  {clue.label}
                </li>
              ))}
            </ol>
          </aside>
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
              onClick={() => clickFallback(spot)}
            >
              <span>{spot.label}</span>
            </button>
          ))}
          {scene !== 'hallway' && (
            <button
              className={styles.back}
              aria-label="volver al pasillo"
              onClick={() => move('hallway', phase === 'decision' ? 'Volves al pasillo. La calle y el espejo ya son dos finales distintos.' : 'Volves al pasillo.')}
            >
              &larr; pasillo
            </button>
          )}
          {phase === 'decision' && letterOpen && (
            <div className={styles.finalPrompt} role="group" aria-label="decision final">
              <p>La casa ya no es un laberinto: es una decision.</p>
              <button onClick={() => finish('leave')}>salir con la caja</button>
              <button onClick={() => finish('stay')}>entrar en la foto</button>
            </div>
          )}
          <div className={styles.caption} aria-live="polite">{message}</div>
          {searchAwake && phase !== 'decision' && (
            <p className={styles.question}>{currentHint || 'La carta de Malena ya puede abrirse.'}</p>
          )}
          <p className={styles.sceneName}>{scene === 'hallway' ? 'pasillo' : scene === 'living' ? 'living' : scene === 'kitchen' ? 'cocina' : 'cuarto'}</p>
          {debug && (
            <output className={styles.debug}>
              {JSON.stringify({ phase, flags, progress, behavior: engine.current?.get().behavior, readings: engine.current?.get().readings.slice(-3) }, null, 1)}
            </output>
          )}
        </div>
      </div>
    </main>
  );
}
