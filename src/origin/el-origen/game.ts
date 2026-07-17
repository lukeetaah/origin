import {
  ActionId,
  DirectorState,
  EndingId,
  Fact,
  FactKind,
  FlagId,
  GameState,
  Hotspot,
  InspectedObjectState,
  InspectionClueId,
  InteractiveObjectId,
  NarrativeEvidence,
  NotebookLine,
  OriginMemory,
  SAVE_VERSION,
  SceneId,
} from './types';
import { requirementsMet, sceneRegistry, visibleHotspotsForScene } from './scenes';
import { findInspectionClue, getInspectableObject } from './inspection';

const finalQuestion = 'Tu firma ya figura.';

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
    evidence: [],
    objectStates: {},
    notebook: openingNotebook(memory),
    notice: 'Cuaderno azul y carpeta. Antes de las 20:00.',
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
    return { ok: false, reason: 'Todavía no volvió a pasar.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'carry')) {
    return { ok: false, reason: 'Falta la libreta.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'flag' && requirement.flag === 'behaviorProfileSeen')) {
    return { ok: false, reason: 'Algo te está mirando.' };
  }
  return { ok: false, reason: 'Falta una pista.' };
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
    const firstEntry = !next.started;
    const memory = {
      ...next.memory,
      entries: firstEntry ? next.memory.entries + 1 : next.memory.entries,
    };
    return touch({
      ...next,
      started: true,
      startedAt: firstEntry ? now : next.startedAt,
      flags: { ...next.flags, entered: true },
      memory,
      notice: 'Cuaderno azul y carpeta. Antes de las 20:00.',
    });
  }

  const targetScene = routeByAction[action];
  if (targetScene) {
    if (action === 'openApartmentDoor' && !next.flags.envelopeRead) {
      next = addFact(
        setFlag(next, 'envelopeRead'),
        'valuation-order',
        'tramite',
        'Pagaron la luz ocho días después de internarla.',
        'Pagaron la luz después de internarla.',
      );
    }
    return travelTo(next, targetScene);
  }

  switch (action) {
    case 'readEnvelope':
      return addFact(
        setFlag(next, 'envelopeRead'),
        'valuation-order',
        'tramite',
        'Pagaron la luz ocho días después de internarla.',
        'Pagaron la luz después de internarla.',
      );

    case 'inspectPhoto':
      next = addFact(
        setFlag(next, 'photoMismatch'),
        'photo-removal',
        'familia',
        'La foto fue tomada después del supuesto cierre.',
        'La foto es reciente.',
      );
      return pushNotebook(next, {
        id: 'photo-gap',
        text: 'La foto es posterior al cierre.',
      });

    case 'tuneRadio':
      next = addFact(
        setFlag(next, 'radioTuned'),
        'cassette-visits',
        'familia',
        'La cinta asigna turnos para repetirle que olvidaba.',
        'Las voces siguen un guion.',
      );
      return pushNotebook(next, {
        id: 'radio-turns',
        text: 'Las llamadas seguían un guion.',
      });

    case 'inspectPot':
      next = addFact(
        setFlag(next, 'potRemembered'),
        'repaired-soup-tureen',
        'familia',
        'La sopera oculta una copia de llave.',
        'Hay una copia adentro.',
      );
      return pushNotebook(next, {
        id: 'tureen-rule',
        text: 'La sopera ocultaba una copia.',
      });

    case 'inspectFolder':
      next = addFact(
        setFlag(next, 'folderFound'),
        'succession-folder',
        'tramite',
        'La oferta precede la internación y exige tu firma.',
        'La oferta ya estaba lista.',
      );
      return pushNotebook(next, {
        id: 'folder-dates',
        text: 'La oferta precede la internación.',
      });

    case 'checkFridge':
      next = addFact(
        setFlag(next, 'fridgeChecked'),
        'fridge-proof',
        'conducta',
        'Hay medicación nueva detrás de comida vencida.',
        'Prepararon una escena de abandono.',
      );
      return pushNotebook(next, {
        id: 'fridge-staging',
        text: 'La casa no estaba abandonada.',
      });

    case 'loosenTile':
      return setNotice(setFlag(next, 'tileLoose'), 'Detrás hay tela azul.');

    case 'takeNotebook':
      next = setFlag(setFlag(setFlag(next, 'notebookFound'), 'ledgerDecoded'), 'tileLoose');
      next = { ...next, carrying: 'notebook' };
      next = addFact(
        next,
        'blue-protocol',
        'protocolo',
        'Anotaron cortes, objetos movidos y frases para hacerla dudar.',
        'Era un guion familiar.',
      );
      next = pushNotebook(next, {
        id: 'first-protocol',
        text: 'La familia anotó cómo desgastarla.',
      });
      if (next.memory.entries > 1) {
        next = pushNotebook(next, {
          id: 'house-remembers',
          text: 'Ya estuve acá.',
        });
      }
      return next;

    case 'readNotebook':
      if (next.carrying !== 'notebook') {
        return setNotice(next, 'Falta la libreta.');
      }
      next = pushNotebook(next, {
        id: 'notebook-rule',
        text: 'Llamaban “acompañar” a vigilarla.',
      });
      if (next.scene === 'hidden') {
        next = setFlag(setFlag(next, 'registryUnderstood'), 'truthUnderstood');
        next = addFact(
          next,
          'hidden-registry',
          'anomalia',
          'La pared registra tus dos visitas y cada objeto elegido.',
          'Tu nombre aparece dos veces.',
        );
      }
      return next;

    case 'inspectKeyring':
      return addFact(
        setFlag(next, 'keyringSeen'),
        'grandmother-keyring',
        'familia',
        'La etiqueta azul fue cortada del aro.',
        'La llave azul fue arrancada.',
      );

    case 'watchTV1986':
      next = addFact(
        setFlag(next, 'tv1986Seen'),
        'tv-1986-signal',
        'anomalia',
        'La señal enumera el recorrido que acabás de hacer.',
        'La señal repite tu recorrido.',
      );
      return pushNotebook(next, {
        id: 'tv-board',
        text: 'La señal conoce mi recorrido.',
      });

    case 'inspectServicePlan':
      next = addFact(
        setFlag(next, 'servicePlanSeen'),
        'service-plan',
        'protocolo',
        'El plano oficial borra el acceso de servicio.',
        'El servicio fue borrado.',
      );
      return pushNotebook(next, {
        id: 'service-plan',
        text: 'El pasillo no figura.',
      });

    case 'inspectBehaviorProfile':
      next = addFact(
        setFlag(next, 'behaviorProfileSeen'),
        'behavior-profile',
        'conducta',
        'La etiqueta dice LUCAS F., VISITA 02 y anticipa cocina.',
        'Registró tu segunda visita.',
      );
      return pushNotebook(next, {
        id: 'behavior-profile',
        text: 'Esta es mi segunda visita.',
      });

    case 'overlayLedgerAndPlan':
      next = setFlag(setFlag(setFlag(next, 'planOverlayDone'), 'registryUnderstood'), 'truthUnderstood');
      next = addFact(
        next,
        'ledger-plan-overlay',
        'protocolo',
        'Plano y cuaderno asignan una acción familiar a cada cuarto.',
        'Cada cuarto tenía una función.',
      );
      return pushNotebook(next, {
        id: 'overlay-truth',
        text: 'Usaron la casa como tablero.',
      });

    case 'openHiddenPanel':
      next = setFlag(next, 'hiddenPanelOpened');
      return setNotice(next, 'El panel estaba destrabado.');

    case 'inspectValuation':
      next = setFlag(next, 'valuationReady');
      next = addFact(
        next,
        'behavioral-valuation',
        'tasacion',
        'La operación figura registrada tres días antes de tu llegada.',
        'Tu firma ya estaba cargada.',
      );
      return pushNotebook(next, {
        id: 'valuation-choice',
        text: 'La venta ya figuraba registrada.',
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
        text: 'Mi letra coincide con la anterior.',
      });
      return finish(next, 'despertar');

    case 'wait':
      return setNotice(trackIgnored(next), 'El ascensor subió un piso.');

    default:
      return next;
  }
}

export function recoverFromCorruptSave(memory?: OriginMemory) {
  const recovered = createMemory({
    ...(memory ?? {}),
    corruptSavesRecovered: (memory?.corruptSavesRecovered ?? 0) + 1,
  });
  return setNotice(freshGame(recovered), 'La partida anterior no era válida.');
}

function emptyDirector(): DirectorState {
  return {
    sceneVisits: { door: 1 },
    routeCounts: {},
    ignoredItems: [],
    heldActionsAbandoned: 0,
    cues: [],
    hiddenWhileActive: 0,
    tensionEvents: [],
    lastTensionAction: -99,
    flashlightEvents: [],
    strongStartleUsed: false,
  };
}

export function discoverInspectionClue(state: GameState, objectId: InteractiveObjectId, clueId: InspectionClueId): GameState {
  const inspectable = getInspectableObject(objectId);
  const clue = findInspectionClue(objectId, clueId);
  if (!inspectable || !clue) return state;
  const currentObjectState = getInspectedObjectState(state, objectId);
  if (currentObjectState.discoveredClues.includes(clueId)) {
    return setNotice(state, inspectable.afterClueObservation);
  }

  let next: GameState = {
    ...state,
    objectStates: {
      ...state.objectStates,
      [objectId]: {
        ...currentObjectState,
        inspected: true,
        open: currentObjectState.open || Boolean(clue.requiresOpen),
        discoveredClues: [...currentObjectState.discoveredClues, clueId],
      },
    },
  };

  next = recordEvidence(next, {
    id: `${objectId}:${clueId}`,
    objectId,
    clueId,
    icon: evidenceIcon(inspectable.model),
    title: clue.title,
    fact: clue.fact,
    question: clue.question,
    link: clue.requiresLight ? 'visible sólo con luz rasante' : clue.requiresOpen ? 'oculto en el interior' : undefined,
    at: Date.now(),
  });

  next = applyAction(next, clue.consequence);
  next = setNotice(next, clue.reveal);

  if (objectId === 'family-photo') {
    next = setFlag(next, 'serviceDoorPhotoSeen');
    next = markObjectChanged(next, objectId);
  }
  if (objectId === 'behavior-sensor') next = setFlag(next, 'familyMessageContradicted');
  return next;
}

export function markObjectInspected(state: GameState, objectId: InteractiveObjectId): GameState {
  const objectState = getInspectedObjectState(state, objectId);
  return {
    ...state,
    objectStates: {
      ...state.objectStates,
      [objectId]: { ...objectState, inspected: true },
    },
  };
}

export function triggerFlashlightEvent(state: GameState, objectId: InteractiveObjectId): GameState {
  const reactiveObjects = new Set<InteractiveObjectId>([
    'family-photo',
    'service-plan',
    'behavior-sensor',
    'hidden-panel',
    'blue-notebook',
  ]);
  if (!reactiveObjects.has(objectId)) return state;
  const eventId = `light-${objectId}`;
  if (state.director.flashlightEvents.includes(eventId)) return state;
  const cue = flashlightCue(objectId);
  let next: GameState = {
    ...state,
    notice: cue,
    director: {
      ...state.director,
      lastLitObject: objectId,
      cues: [...state.director.cues, cue].slice(-5),
      flashlightEvents: [...state.director.flashlightEvents, eventId],
    },
  };

  if (objectId === 'family-photo') {
    next = setFlag(markObjectChanged(next, 'family-photo'), 'objectMovedAfterInspection');
  }
  if (objectId === 'service-plan' || objectId === 'behavior-sensor') {
    next = setFlag(next, 'houseRepeatedAction');
  }
  if (objectId === 'hidden-panel' && !next.director.strongStartleUsed) {
    next = setFlag(next, 'strongStartleUsed');
    next = {
      ...next,
      director: { ...next.director, strongStartleUsed: true },
      notice: 'El panel golpea desde adentro una sola vez. Después, silencio.',
    };
  }
  return next;
}

function openingNotebook(memory: OriginMemory): NotebookLine[] {
  const lines: NotebookLine[] = [
    { id: 'cover-question', text: 'Vine por cuaderno y carpeta.' },
  ];
  if (memory.endings.length > 0) {
    lines.push({ id: 'after-entry', text: 'Ya estuve acá.' });
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

function getInspectedObjectState(state: GameState, objectId: InteractiveObjectId): InspectedObjectState {
  return state.objectStates[objectId] ?? {
    inspected: false,
    open: false,
    changed: false,
    discoveredClues: [],
  };
}

function markObjectChanged(state: GameState, objectId: InteractiveObjectId): GameState {
  const objectState = getInspectedObjectState(state, objectId);
  return {
    ...state,
    objectStates: {
      ...state.objectStates,
      [objectId]: { ...objectState, changed: true },
    },
  };
}

function recordEvidence(state: GameState, evidence: NarrativeEvidence): GameState {
  if (state.evidence.some((item) => item.id === evidence.id)) return state;
  return {
    ...state,
    evidence: [...state.evidence, evidence],
  };
}

function evidenceIcon(model: string) {
  if (model === 'photo') return 'foto';
  if (model === 'keys') return 'llaves';
  if (model === 'notebook') return 'libreta';
  if (model === 'sensor') return 'punto';
  if (model === 'folder') return 'carpeta';
  return 'objeto';
}

function flashlightCue(objectId: string) {
  if (objectId === 'family-photo') return 'La foto queda boca abajo.';
  if (objectId === 'service-plan') return 'La pared responde con dos golpes.';
  if (objectId === 'behavior-sensor') return 'El punto rojo copia tu pulso.';
  if (objectId === 'hidden-panel') return 'El panel golpea desde adentro.';
  if (objectId === 'blue-notebook') return 'La tapa azul todavía está tibia.';
  return 'Un objeto cambió de lugar.';
}

function travelTo(state: GameState, scene: Exclude<SceneId, 'ending'>): GameState {
  const previous = state.scene;
  const key = `${previous}->${scene}`;
  const visits = (state.director.sceneVisits[scene] ?? 0) + 1;
  const routeCount = (state.director.routeCounts[key] ?? 0) + 1;
  const cues = [...state.director.cues];
  if (routeCount === 3) cues.push('La puerta quedó más abierta.');

  const traveled: GameState = {
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

  if (routeCount === 2) return queueTension(traveled, `route-${key}`, routeCue(scene));
  if (visits === 3) return queueTension(traveled, `visit-${scene}`, revisitCue(scene));
  return traveled;
}

function travelNotice(scene: SceneId, visits: number) {
  const sceneInfo = scene === 'ending' ? null : sceneRegistry[scene];
  if (visits > 1 && sceneInfo?.ambient[0]) return `Otra vez: ${sceneInfo.ambient[0]}.`;
  if (scene === 'hallway') return 'La foto familiar tapa el aparador.';
  if (scene === 'living') return 'El televisor muestra tu recorrido.';
  if (scene === 'kitchen') return 'La heladera zumba.';
  if (scene === 'bedroom') return 'Falta una llave.';
  if (scene === 'service') return 'Los caños golpean dos veces.';
  if (scene === 'hidden') return `El archivo tiene tu nombre. ${finalQuestion}`;
  return 'El sobre quedó atrás.';
}

function queueTension(state: GameState, id: string, cue: string): GameState {
  const actionAge = state.actions.length - state.director.lastTensionAction;
  const seenEvents = state.director.tensionEvents ?? [];
  if (seenEvents.includes(id) || actionAge < 3) return state;
  return {
    ...state,
    notice: cue,
    director: {
      ...state.director,
      cues: [...state.director.cues, cue].slice(-5),
      tensionEvents: [...seenEvents, id],
      lastTensionAction: state.actions.length,
    },
  };
}

function routeCue(scene: SceneId) {
  if (scene === 'kitchen') return 'La pava cambió de hornalla.';
  if (scene === 'bedroom') return 'Una foto mira hacia abajo.';
  if (scene === 'service') return 'El golpe viene de más cerca.';
  if (scene === 'living') return 'La pantalla no está apagada.';
  return 'Algo quedó apenas corrido.';
}

function revisitCue(scene: SceneId) {
  if (scene === 'hallway') return 'La foto se movió sola.';
  if (scene === 'kitchen') return 'La heladera dejó de sonar.';
  if (scene === 'bedroom') return 'La cama está más tensa.';
  if (scene === 'service') return 'El panel respiró.';
  if (scene === 'hidden') return 'La pared sumó una línea.';
  return 'La casa recordó el camino.';
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
    return 'Firmás. El formulario ya había marcado esa opción.';
  }
  if (ending === 'resistir') {
    return 'Tachás el precio. El formulario ya lo sabía.';
  }
  if (ending === 'exponer') {
    return 'Copiás el archivo. La instrucción ya decía “copiará”.';
  }
  return 'Escribís tu nombre. La letra anterior también es tuya.';
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
  const next = {
    ...state,
    director: {
      ...state.director,
      heldActionsAbandoned: state.director.heldActionsAbandoned + 1,
    },
  };
  return queueTension(next, `abandon-${state.scene}`, 'Algo empujó del otro lado.');
}
