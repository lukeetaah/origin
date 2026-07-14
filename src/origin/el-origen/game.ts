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

const finalQuestion = 'La cifra espera.';

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
    notice: 'Buscás el cuaderno azul y la carpeta antes de las 22.',
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
    const memory = {
      ...next.memory,
      entries: next.started ? next.memory.entries : next.memory.entries + 1,
    };
    return touch({
      ...next,
      started: true,
      flags: { ...next.flags, entered: true },
      memory,
      notice: 'Entraste por el cuaderno azul y la carpeta.',
    });
  }

  const targetScene = routeByAction[action];
  if (targetScene) {
    if (action === 'openApartmentDoor' && !next.flags.envelopeRead) {
      next = addFact(
        setFlag(next, 'envelopeRead'),
        'valuation-order',
        'tramite',
        'El sobre pide retirar el cuaderno azul y una carpeta antes de que llegue la inmobiliaria. La venta ya tiene hora.',
        'Cuaderno azul, carpeta, 22:00.',
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
        'El sobre pide retirar el cuaderno azul y una carpeta antes de que llegue la inmobiliaria. La venta ya tiene hora.',
        'Cuaderno azul, carpeta, 22:00.',
      );

    case 'inspectPhoto':
      next = addFact(
        setFlag(next, 'photoMismatch'),
        'photo-removal',
        'familia',
        'Las fotos familiares están ordenadas para parecer amorosas, pero los bordes muestran recortes: la casa aprendió a borrar a quienes estorbaban una escritura.',
        'La foto fue tomada acá.',
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
        'La cinta ya estaba a mitad de frase.',
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
        'La sopera pesa como una firma.',
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
        'Primero vino el desgaste. Después, el precio.',
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
        'La heladera fue preparada.',
      );
      return pushNotebook(next, {
        id: 'fridge-staging',
        text: 'Heladera: si el olor sirve a la tasación, no es descuido; es escenografía.',
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
        'La libreta azul no enumera recuerdos. Enumera pasos: aislar, administrar, sugerir deterioro, comprar bajo y convertir la violencia en trámite.',
        'La libreta no explica. Conecta.',
      );
      next = pushNotebook(next, {
        id: 'first-protocol',
        text: 'La casa se abarataba primero en la cabeza.',
      });
      if (next.memory.entries > 1) {
        next = pushNotebook(next, {
          id: 'house-remembers',
          text: 'La casa reconoció otra entrada.',
        });
      }
      return next;

    case 'readNotebook':
      if (next.carrying !== 'notebook') {
        return setNotice(next, 'Falta la libreta.');
      }
      next = pushNotebook(next, {
        id: 'notebook-rule',
        text: 'No escribían presión. Escribían acompañamiento.',
      });
      if (next.scene === 'hidden') {
        next = setFlag(setFlag(next, 'registryUnderstood'), 'truthUnderstood');
        next = addFact(
          next,
          'hidden-registry',
          'anomalia',
          'La pared vieja no registra sólo a la familia: registra visitas futuras, pausas, desvíos y decisiones que todavía no tomaste.',
          'La pared tiene una marca nueva.',
        );
      }
      return next;

    case 'inspectKeyring':
      return addFact(
        setFlag(next, 'keyringSeen'),
        'grandmother-keyring',
        'familia',
        'Las llaves de la abuela tienen etiquetas domésticas: gas, vecina, terraza, pieza fría. Ninguna dice “propiedad”, pero todas prueban uso.',
        'No está la llave azul.',
      );

    case 'watchTV1986':
      next = addFact(
        setFlag(next, 'tv1986Seen'),
        'tv-1986-signal',
        'anomalia',
        'La transmisión deportiva de 1986 es ficticia: el relator nombra habitaciones como si fueran posiciones de un tablero y celebra saltos imposibles entre puertas.',
        'La señal muestra este pasillo.',
      );
      return pushNotebook(next, {
        id: 'tv-board',
        text: 'La señal sabe hacia dónde miro.',
      });

    case 'inspectServicePlan':
      next = addFact(
        setFlag(next, 'servicePlanSeen'),
        'service-plan',
        'protocolo',
        'El plano bajo la pintura marca recorridos de servicio como posiciones de presión: cada puerta produce una excusa para mover, esperar o cobrar.',
        'El pasillo no figura en el plano.',
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
        `El sensor no mide fantasmas: mide tu conducta. Perfil actual: ${behaviorSummary(next)}. La tasación ajusta el precio según docilidad, duda y cansancio.`,
        'El punto rojo imprime una etiqueta.',
      );
      return pushNotebook(next, {
        id: 'behavior-profile',
        text: 'También me están midiendo.',
      });

    case 'overlayLedgerAndPlan':
      next = setFlag(setFlag(setFlag(next, 'planOverlayDone'), 'registryUnderstood'), 'truthUnderstood');
      next = addFact(
        next,
        'ledger-plan-overlay',
        'protocolo',
        'Superpuestos, la libreta y el plano revelan un método: convertir habitaciones en posiciones de deuda, afecto en obligación y obligación en precio final.',
        'Las marcas encajan.',
      );
      return pushNotebook(next, {
        id: 'overlay-truth',
        text: 'La casa fue usada como tablero.',
      });

    case 'openHiddenPanel':
      next = setFlag(next, 'hiddenPanelOpened');
      return setNotice(next, 'El panel abre hacia adentro.');

    case 'inspectValuation':
      next = setFlag(next, 'valuationReady');
      next = addFact(
        next,
        'behavioral-valuation',
        'tasacion',
        `La tasación propone un precio bajo y adjunta un anexo conductual: ${behaviorSummary(next)}. La casa vale menos si aceptás que te apuren.`,
        'La cifra bajó mientras mirabas.',
      );
      return pushNotebook(next, {
        id: 'valuation-choice',
        text: 'El precio mide cansancio.',
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
        text: 'Dejo mi nombre para cortar el método.',
      });
      return finish(next, 'despertar');

    case 'wait':
      return setNotice(trackIgnored(next), 'Algo se acercó cuando esperaste.');

    default:
      return next;
  }
}

export function recoverFromCorruptSave(memory?: OriginMemory) {
  const recovered = createMemory({
    ...(memory ?? {}),
    corruptSavesRecovered: (memory?.corruptSavesRecovered ?? 0) + 1,
  });
  return setNotice(freshGame(recovered), 'La casa abrió una entrada limpia.');
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
    { id: 'cover-question', text: 'Vine por el cuaderno azul y la carpeta.' },
  ];
  if (memory.endings.length > 0) {
    lines.push({ id: 'after-entry', text: 'La casa se acordó de mí.' });
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
  if (objectId === 'family-photo') return 'Cuando apartás la luz, la foto queda boca abajo.';
  if (objectId === 'service-plan') return 'La línea borrada brilla y el golpe responde desde la pared.';
  if (objectId === 'behavior-sensor') return 'El punto rojo parpadea con tu mismo pulso.';
  if (objectId === 'hidden-panel') return 'Detrás del panel alguien espera a que mires otro lado.';
  if (objectId === 'blue-notebook') return 'La tapa azul se calienta sólo dentro del haz.';
  return 'Algo cambió fuera del haz.';
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
  if (scene === 'hallway') return 'El pasillo escucha.';
  if (scene === 'living') return 'El televisor espera.';
  if (scene === 'kitchen') return 'La heladera zumba.';
  if (scene === 'bedroom') return 'Falta una llave.';
  if (scene === 'service') return 'Los caños golpean dos veces.';
  if (scene === 'hidden') return `El hueco no explica el secreto. Lo vuelve material. ${finalQuestion}`;
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
  const next = {
    ...state,
    director: {
      ...state.director,
      heldActionsAbandoned: state.director.heldActionsAbandoned + 1,
    },
  };
  return queueTension(next, `abandon-${state.scene}`, 'Algo empujó del otro lado.');
}
