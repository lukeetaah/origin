import {
  ActionId,
  DirectorState,
  EndingId,
  Fact,
  FactKind,
  FlagId,
  GameState,
  Hotspot,
  NotebookLine,
  OriginMemory,
  SAVE_VERSION,
  SceneId,
} from './types';
import { requirementsMet, sceneRegistry, visibleHotspotsForScene } from './scenes';

const finalQuestion = '¿Cuánto vale una casa cuando por fin deja de obedecer?';

const routeByAction: Partial<Record<ActionId, Exclude<SceneId, 'ending'>>> = {
  openApartmentDoor: 'hallway',
  travelHallway: 'hallway',
  travelLiving: 'living',
  travelKitchen: 'kitchen',
  travelBedroom: 'bedroom',
  travelService: 'service',
  travelHidden: 'hidden',
};

export function createMemory(seed?: Partial<OriginMemory>): OriginMemory {
  return {
    version: SAVE_VERSION,
    entries: seed?.entries ?? 0,
    endings: [...(seed?.endings ?? [])],
    returnedNotebook: Boolean(seed?.returnedNotebook),
    deliveredNotebook: Boolean(seed?.deliveredNotebook),
    hiddenNotebook: Boolean(seed?.hiddenNotebook),
    repeatedRoutes: { ...(seed?.repeatedRoutes ?? {}) },
    contradictions: [...(seed?.contradictions ?? [])],
    corruptSavesRecovered: seed?.corruptSavesRecovered ?? 0,
    lastNotebookLine: seed?.lastNotebookLine,
  };
}

export function freshGame(memory = createMemory()): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    runId: `origen-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    started: false,
    scene: 'door',
    carrying: null,
    flags: {},
    facts: [],
    notebook: openingNotebook(memory),
    notice: 'La familia pidió un favor sencillo: entrar, juntar papeles y dejar lista la tasación.',
    ending: null,
    actions: [],
    route: ['door'],
    director: emptyDirector(),
    memory,
    startedAt: now,
    updatedAt: now,
  };
}

export function visibleHotspots(state: GameState) {
  return visibleHotspotsForScene(state);
}

export function canUseHotspot(state: GameState, hotspot: Hotspot): { ok: boolean; reason?: string } {
  if (requirementsMet(state, hotspot.requirements ?? [])) return { ok: true };
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'memoryEndings')) {
    return { ok: false, reason: 'La casa todavía no reconoce una visita anterior con suficiente peso.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'carry')) {
    return { ok: false, reason: 'Ese lugar pide que lleves la libreta en la mano.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'flag' && requirement.flag === 'behaviorProfileSeen')) {
    return { ok: false, reason: 'Todavía no viste cómo te están midiendo.' };
  }
  return { ok: false, reason: 'Todavía falta una comprobación material.' };
}

export function applyAction(state: GameState, action: ActionId): GameState {
  if (state.scene === 'ending' && action !== 'startAgain') return state;
  const now = Date.now();
  let next = touch({
    ...state,
    actions: [...state.actions, action],
    updatedAt: now,
  });

  if (action === 'startAgain') return freshGame(next.memory);

  if (action === 'enter' || action === 'continue') {
    const memory = {
      ...next.memory,
      entries: next.started ? next.memory.entries : next.memory.entries + 1,
    };
    return touch({
      ...next,
      started: true,
      flags: { ...next.flags, entered: true },
      memory,
      notice: 'No venís a resolver una herencia: venís a decidir qué versión de esta casa va a quedar escrita.',
    });
  }

  const targetScene = routeByAction[action];
  if (targetScene) return travelTo(next, targetScene);

  switch (action) {
    case 'readEnvelope':
      return addFact(
        setFlag(next, 'envelopeRead'),
        'valuation-order',
        'tramite',
        'El sobre no pide recuerdos: pide llaves, recibos, estado de la heladera y una firma para bajar el valor por “abandono funcional”.',
        'La tasadora dejó una orden demasiado limpia para una casa todavía llena de decisiones.',
      );

    case 'inspectPhoto':
      next = addFact(
        setFlag(next, 'photoMismatch'),
        'photo-removal',
        'familia',
        'Las fotos familiares están ordenadas para parecer amorosas, pero los bordes muestran recortes: la casa aprendió a borrar a quienes estorbaban una escritura.',
        'La luz revela una ausencia fabricada. No falta una persona: falta una versión entera.',
      );
      return pushNotebook(next, {
        id: 'photo-gap',
        text: 'Fotos: nadie desaparece del todo; a veces queda el borde del pegamento.',
      });

    case 'tuneRadio':
      next = addFact(
        setFlag(next, 'radioTuned'),
        'cassette-visits',
        'familia',
        'La cinta registra visitas de cuidado como turnos: quién entraba, quién firmaba, quién lograba que la dueña dudara de su propia memoria.',
        'Entre estática y voces bajas, la familia no suena nostálgica. Suena organizada.',
      );
      return pushNotebook(next, {
        id: 'radio-turns',
        text: 'Cinta: cuidado no era ternura; era una técnica de desgaste con horario fijo.',
      });

    case 'inspectPot':
      next = addFact(
        setFlag(next, 'potRemembered'),
        'repaired-soup-tureen',
        'familia',
        'La sopera está soldada cinco veces. La usaban para hablar de sacrificio, pero en los márgenes de la libreta aparece como premio por firmar barato.',
        'La sopera no conserva una comida familiar. Conserva una negociación.',
      );
      return pushNotebook(next, {
        id: 'tureen-rule',
        text: 'Sopera reparada: cuando un objeto se vuelve sagrado, alguien suele estar escondiendo el precio.',
      });

    case 'inspectFolder':
      next = addFact(
        setFlag(next, 'folderFound'),
        'succession-folder',
        'tramite',
        'La carpeta mezcla sucesión, tasación y un borrador de compraventa. La firma que falta no es un olvido: era el último obstáculo.',
        'La carpeta parece administrativa hasta que ordenás las fechas. Primero vino el desgaste; después, el precio.',
      );
      return pushNotebook(next, {
        id: 'folder-dates',
        text: 'Carpeta: cuando las fechas cierran demasiado bien, la verdad suele estar en lo que dejaron afuera.',
      });

    case 'checkFridge':
      next = addFact(
        setFlag(next, 'fridgeChecked'),
        'fridge-proof',
        'conducta',
        'La heladera fue preparada para contar una historia de abandono: comida vencida adelante, medicación reciente escondida atrás, recibos nuevos bajo el cajón.',
        'La heladera no prueba abandono. Prueba puesta en escena.',
      );
      return pushNotebook(next, {
        id: 'fridge-staging',
        text: 'Heladera: si el olor sirve a la tasación, no es descuido; es escenografía.',
      });

    case 'loosenTile':
      return setNotice(setFlag(next, 'tileLoose'), 'El azulejo cede. Detrás no hay una reliquia: hay una instrucción doblada con una precisión incómoda.');

    case 'takeNotebook':
      next = setFlag(setFlag(setFlag(next, 'notebookFound'), 'ledgerDecoded'), 'tileLoose');
      next = { ...next, carrying: 'notebook' };
      next = addFact(
        next,
        'blue-protocol',
        'protocolo',
        'La libreta azul no enumera recuerdos. Enumera pasos: aislar, administrar, sugerir deterioro, comprar bajo y convertir la violencia en trámite.',
        'La libreta aparece detrás del azulejo, envuelta contra la humedad. No parece escondida para proteger a la abuela; parece escondida para que alguien la encontrara tarde.',
      );
      next = pushNotebook(next, {
        id: 'first-protocol',
        text: 'Protocolo doméstico: una casa se devalúa primero en la cabeza de su dueña.',
      });
      if (next.memory.entries > 1) {
        next = pushNotebook(next, {
          id: 'house-remembers',
          text: 'Hay una marca que no hice hoy. La casa reconoce la repetición.',
        });
      }
      return next;

    case 'readNotebook':
      if (next.carrying !== 'notebook') {
        return setNotice(next, 'La pared enumera marcas incompletas. Falta la libreta para entender el orden.');
      }
      next = pushNotebook(next, {
        id: 'notebook-rule',
        text: 'No escribir “robo”. Escribir “administración”. No escribir “presión”. Escribir “acompañamiento”.',
      });
      if (next.scene === 'hidden') {
        next = setFlag(setFlag(next, 'registryUnderstood'), 'truthUnderstood');
        next = addFact(
          next,
          'hidden-registry',
          'anomalia',
          'La pared vieja no registra sólo a la familia: registra visitas futuras, pausas, desvíos y decisiones que todavía no tomaste.',
          'La pared sabe demasiado. La casa no acusa; mide si estás dispuesto a mirar.',
        );
      }
      return next;

    case 'inspectKeyring':
      return addFact(
        setFlag(next, 'keyringSeen'),
        'grandmother-keyring',
        'familia',
        'Las llaves de la abuela tienen etiquetas domésticas: gas, vecina, terraza, pieza fría. Ninguna dice “propiedad”, pero todas prueban uso.',
        'El llavero no abre una herencia. Abre responsabilidades que nadie quiso valorar.',
      );

    case 'watchTV1986':
      next = addFact(
        setFlag(next, 'tv1986Seen'),
        'tv-1986-signal',
        'anomalia',
        'La transmisión deportiva de 1986 es ficticia: el relator nombra habitaciones como si fueran posiciones de un tablero y celebra saltos imposibles entre puertas.',
        'La pantalla prende sola. La casa traduce el trámite a reglas de juego: avanzar, caer, pagar, volver a intentar.',
      );
      return pushNotebook(next, {
        id: 'tv-board',
        text: 'Televisor: no muestra pasado; muestra un tablero con deuda, avance y castigo.',
      });

    case 'inspectServicePlan':
      next = addFact(
        setFlag(next, 'servicePlanSeen'),
        'service-plan',
        'protocolo',
        'El plano bajo la pintura marca recorridos de servicio como posiciones de presión: cada puerta produce una excusa para mover, esperar o cobrar.',
        'Bajo la pintura aparece un plano con flechas. La casa fue usada como tablero antes de ser usada como hogar.',
      );
      return pushNotebook(next, {
        id: 'service-plan',
        text: 'Plano: no dibuja habitaciones; dibuja presión, distancia y obediencia.',
      });

    case 'inspectBehaviorProfile':
      next = addFact(
        setFlag(next, 'behaviorProfileSeen'),
        'behavior-profile',
        'conducta',
        `El sensor no mide fantasmas: mide tu conducta. Perfil actual: ${behaviorSummary(next)}. La tasación ajusta el precio según docilidad, duda y cansancio.`,
        'El punto rojo no estaba roto. Te estaba leyendo desde que entraste.',
      );
      return pushNotebook(next, {
        id: 'behavior-profile',
        text: `Perfil de conducta observado: ${behaviorSummary(next)}.`,
      });

    case 'overlayLedgerAndPlan':
      next = setFlag(setFlag(setFlag(next, 'planOverlayDone'), 'registryUnderstood'), 'truthUnderstood');
      next = addFact(
        next,
        'ledger-plan-overlay',
        'protocolo',
        'Superpuestos, la libreta y el plano revelan un método: convertir habitaciones en posiciones de deuda, afecto en obligación y obligación en precio final.',
        'La libreta encaja sobre el plano como si el departamento siempre hubiera sido un contrato disfrazado de casa.',
      );
      return pushNotebook(next, {
        id: 'overlay-truth',
        text: 'La familia no heredó una casa embrujada; fabricó una casa obediente. Lo imposible empezó cuando la casa dejó de obedecer.',
      });

    case 'openHiddenPanel':
      next = setFlag(next, 'hiddenPanelOpened');
      return setNotice(next, 'El panel corre. Del otro lado no hay un susto: hay archivo, humedad y una paciencia más vieja que la familia.');

    case 'inspectValuation':
      next = setFlag(next, 'valuationReady');
      next = addFact(
        next,
        'behavioral-valuation',
        'tasacion',
        `La tasación propone un precio bajo y adjunta un anexo conductual: ${behaviorSummary(next)}. La casa vale menos si aceptás que te apuren.`,
        'La carpeta ya no parece papel: parece una trampa con renglones.',
      );
      return pushNotebook(next, {
        id: 'valuation-choice',
        text: 'Tasación: el precio no mide la casa; mide cuánto creen que me pueden cansar.',
      });

    case 'acceptLowPrice':
      next = setFlag(next, 'lowPriceMarked');
      return finish(next, 'ceder');

    case 'refusePrice':
      next = setFlag(next, 'priceRefused');
      return finish(next, 'resistir');

    case 'exposeProtocol':
      next = setFlag(next, 'protocolExposed');
      return finish(next, 'exponer');

    case 'writeNameAndHangNotebook':
      next = setFlag(next, 'nameWritten');
      next = pushNotebook(next, {
        id: 'last-empty-line',
        text: 'Última línea: dejo mi nombre no para heredar, sino para interrumpir el método.',
      });
      return finish(next, 'despertar');

    case 'wait':
      return setNotice(trackIgnored(next), 'Esperar también juega. La casa anota qué miraste, qué evitaste y cuánto tardaste en discutir el precio.');

    default:
      return next;
  }
}

export function recoverFromCorruptSave(memory?: OriginMemory) {
  const recovered = createMemory({
    ...(memory ?? {}),
    corruptSavesRecovered: (memory?.corruptSavesRecovered ?? 0) + 1,
  });
  return setNotice(freshGame(recovered), 'La partida guardada estaba dañada. La casa abrió una entrada limpia sin mezclar versiones viejas.');
}

function emptyDirector(): DirectorState {
  return {
    sceneVisits: { door: 1 },
    routeCounts: {},
    ignoredItems: [],
    heldActionsAbandoned: 0,
    cues: [],
    hiddenWhileActive: 0,
  };
}

function openingNotebook(memory: OriginMemory): NotebookLine[] {
  const lines: NotebookLine[] = [
    { id: 'cover-question', text: 'Entré por papeles; la casa contestó con reglas.' },
  ];
  if (memory.endings.length > 0) {
    lines.push({ id: 'after-entry', text: 'Al volver, una línea aparece más oscura aunque nadie la escribió delante mío.' });
  }
  if (memory.lastNotebookLine) lines.push({ id: 'memory-last-line', text: memory.lastNotebookLine });
  return lines;
}

function touch(state: GameState): GameState {
  return { ...state, updatedAt: Date.now() };
}

function setFlag(state: GameState, flag: FlagId): GameState {
  return {
    ...state,
    flags: { ...state.flags, [flag]: true },
  };
}

function setNotice(state: GameState, notice: string): GameState {
  return { ...state, notice };
}

function addFact(state: GameState, id: string, kind: FactKind, text: string, notice: string): GameState {
  const existing = state.facts.some((fact) => fact.id === id);
  const fact: Fact = { id, kind, text, scene: state.scene, at: Date.now() };
  const contradictions = (kind === 'familia' || kind === 'anomalia') && !state.memory.contradictions.includes(id)
    ? [...state.memory.contradictions, id]
    : state.memory.contradictions;
  return {
    ...state,
    facts: existing ? state.facts : [...state.facts, fact],
    memory: { ...state.memory, contradictions },
    notice,
  };
}

function pushNotebook(state: GameState, line: NotebookLine): GameState {
  if (state.notebook.some((entry) => entry.id === line.id)) return state;
  return {
    ...state,
    notebook: [...state.notebook, line],
  };
}

function travelTo(state: GameState, scene: Exclude<SceneId, 'ending'>): GameState {
  const previous = state.scene;
  const key = `${previous}->${scene}`;
  const visits = (state.director.sceneVisits[scene] ?? 0) + 1;
  const routeCount = (state.director.routeCounts[key] ?? 0) + 1;
  const cues = [...state.director.cues];
  if (routeCount === 3) cues.push('La tercera vez por el mismo tramo, la casa deja una corriente fría en el zócalo.');

  return {
    ...state,
    scene,
    previousScene: previous,
    route: [...state.route, scene],
    flags: scene === 'hallway' && previous === 'door' ? { ...state.flags, doorOpened: true } : state.flags,
    director: {
      ...state.director,
      sceneVisits: { ...state.director.sceneVisits, [scene]: visits },
      routeCounts: { ...state.director.routeCounts, [key]: routeCount },
      cues: cues.slice(-5),
    },
    memory: {
      ...state.memory,
      repeatedRoutes: { ...state.memory.repeatedRoutes, [key]: routeCount },
    },
    notice: travelNotice(scene, visits),
  };
}

function travelNotice(scene: SceneId, visits: number) {
  const sceneInfo = scene === 'ending' ? null : sceneRegistry[scene];
  if (visits > 1 && sceneInfo?.ambient[0]) return `Volvés por el mismo lugar. Ahora se oye ${sceneInfo.ambient[0]}.`;
  if (scene === 'hallway') return 'El pasillo no conecta cuartos: reparte versiones del mismo negocio.';
  if (scene === 'living') return 'El living comedor ensaya una familia prolija para quien mire rápido.';
  if (scene === 'kitchen') return 'La cocina está armada para probar descuido. Eso ya la vuelve sospechosa.';
  if (scene === 'bedroom') return 'El dormitorio de la abuela está demasiado quieto para haber terminado.';
  if (scene === 'service') return 'El pasillo de servicio tiene una humedad con forma de tablero.';
  if (scene === 'hidden') return `El hueco no explica el secreto. Lo vuelve material. ${finalQuestion}`;
  return 'La puerta queda atrás, pero el sobre sigue pesando.';
}

function finish(state: GameState, ending: EndingId): GameState {
  const now = Date.now();
  const endingSet = new Set(state.memory.endings);
  endingSet.add(ending);
  const memory: OriginMemory = {
    ...state.memory,
    endings: [...endingSet],
    deliveredNotebook: state.memory.deliveredNotebook || ending === 'ceder' || ending === 'exponer',
    hiddenNotebook: state.memory.hiddenNotebook || ending === 'despertar',
    returnedNotebook: state.memory.returnedNotebook || ending === 'resistir' || ending === 'despertar',
    lastNotebookLine: ending === 'despertar'
      ? 'La libreta queda abierta. La casa ya no pide obediencia: pide testigos.'
      : state.memory.lastNotebookLine,
  };

  return {
    ...state,
    scene: 'ending',
    carrying: null,
    ending,
    memory,
    endedAt: now,
    updatedAt: now,
    notice: endingNotice(ending),
  };
}

function endingNotice(ending: EndingId) {
  if (ending === 'ceder') {
    return 'Firmás la tasación baja. La operación cierra, la familia respira y la casa queda oficialmente barata. Pero el televisor sigue prendido, esperando otra visita.';
  }
  if (ending === 'resistir') {
    return 'Rechazás el precio y dejás constancia del método. No ganás una casa limpia: ganás tiempo, prueba y una incomodidad imposible de volver trámite.';
  }
  if (ending === 'exponer') {
    return 'Preparás el archivo completo: libreta, plano, sensor y tasación. La historia deja de ser familiar y se vuelve denunciable. La casa, por primera vez, no baja la voz.';
  }
  return 'Escribís tu nombre en la última línea. La casa no se vende ni se absuelve: despierta como tablero vivo, lista para castigar cualquier nueva administración disfrazada de cuidado.';
}

function behaviorSummary(state: GameState) {
  const maxRoute = Math.max(0, ...Object.values(state.director.routeCounts));
  const traits: string[] = [];
  if (maxRoute >= 3) traits.push('recorrido repetitivo');
  if (state.director.heldActionsAbandoned > 0) traits.push('duda ante gestos sostenidos');
  if (state.director.hiddenWhileActive > 0) traits.push('pausas fuera de foco');
  if (state.director.ignoredItems.length > 6) traits.push('evitación de objetos visibles');
  if (state.flags.fridgeChecked && state.flags.folderFound) traits.push('resistencia documental');
  if (state.flags.tv1986Seen) traits.push('alta tolerancia a señales anómalas');
  return traits.length > 0 ? traits.join(', ') : 'exploración directa con baja docilidad registrada';
}

function trackIgnored(state: GameState): GameState {
  const visibleIds = visibleHotspots(state).map((hotspot) => hotspot.id);
  return {
    ...state,
    director: {
      ...state.director,
      ignoredItems: [...new Set([...state.director.ignoredItems, ...visibleIds])].slice(-12),
    },
  };
}

export function abandonHeldAction(state: GameState): GameState {
  return {
    ...state,
    director: {
      ...state.director,
      heldActionsAbandoned: state.director.heldActionsAbandoned + 1,
    },
  };
}
