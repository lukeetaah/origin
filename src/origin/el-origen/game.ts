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

const finalQuestion = 'El renglón siguiente espera la misma letra.';

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
    notice: 'Mamá escribió: «sacá el cuaderno azul y la carpeta antes de las 20:00. No leas nada».',
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
    return { ok: false, reason: 'Esa línea sólo aparece después de que ya elegiste una vez.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'carry')) {
    return { ok: false, reason: 'El hueco reconoce el cuaderno. Volvé con él.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'flag' && requirement.flag === 'behaviorProfileSeen')) {
    return { ok: false, reason: 'Todavía no sabés qué está midiendo el punto rojo.' };
  }
  return { ok: false, reason: 'La casa no te deja saltear esta parte.' };
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
      notice: 'Son las 19:41. Sacá el cuaderno azul y la carpeta. Mamá ya sabía cuánto ibas a tardar.',
    });
  }

  const targetScene = routeByAction[action];
  if (targetScene) {
    if (action === 'openApartmentDoor' && !next.flags.envelopeRead) {
      next = addFact(
        setFlag(next, 'envelopeRead'),
        'valuation-order',
        'tramite',
        'Pagaron la luz ocho días después de internarla, desde una cuenta a tu nombre.',
        'La casa siguió encendida para preparar tu visita.',
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
        'Pagaron la luz ocho días después de internarla, desde una cuenta a tu nombre.',
        'La casa siguió encendida para preparar tu visita.',
      );

    case 'inspectPhoto':
      next = addFact(
        setFlag(next, 'photoMismatch'),
        'photo-removal',
        'familia',
        'La foto es de ayer. En el vidrio, quien la toma lleva tu campera.',
        'La foto se tomó ayer. Vos aparecés detrás de la cámara.',
      );
      return pushNotebook(next, {
        id: 'photo-gap',
        text: 'Yo estaba detrás de la cámara.',
      });

    case 'tuneRadio':
      next = addFact(
        setFlag(next, 'radioTuned'),
        'cassette-visits',
        'familia',
        'La cinta reparte frases para hacerla dudar. Tu voz da la orden de empezar.',
        'Antes de las otras voces, escuchás la tuya diciendo «empezamos».',
      );
      return pushNotebook(next, {
        id: 'radio-turns',
        text: 'Mi voz abre el guion familiar.',
      });

    case 'inspectPot':
      next = addFact(
        setFlag(next, 'potRemembered'),
        'repaired-soup-tureen',
        'familia',
        'La sopera oculta la llave del cuarto borrado y una etiqueta con tu nombre.',
        'El papel atado a la copia dice: «devolver a Tomás».',
      );
      return pushNotebook(next, {
        id: 'tureen-rule',
        text: 'Separaron la llave para mí.',
      });

    case 'inspectFolder':
      next = addFact(
        setFlag(next, 'folderFound'),
        'succession-folder',
        'tramite',
        'La oferta precede la internación. La autorización de ingreso lleva tu firma.',
        'Vendieron la casa antes de internarla. Vos autorizaste la visita.',
      );
      return pushNotebook(next, {
        id: 'folder-dates',
        text: 'Autoricé entrar antes de que ella pudiera negarse.',
      });

    case 'checkFridge':
      next = addFact(
        setFlag(next, 'fridgeChecked'),
        'fridge-proof',
        'conducta',
        'La medicación es nueva; la comida vencida fue puesta adelante para fingir abandono.',
        'Alguien armó la escena después. La lista de tareas tiene tus iniciales.',
      );
      return pushNotebook(next, {
        id: 'fridge-staging',
        text: 'Ayudé a que pareciera abandonada.',
      });

    case 'loosenTile':
      return setNotice(setFlag(next, 'tileLoose'), 'La tela azul está anudada como la pulsera de la clínica.');

    case 'takeNotebook':
      next = setFlag(setFlag(setFlag(next, 'notebookFound'), 'ledgerDecoded'), 'tileLoose');
      next = { ...next, carrying: 'notebook' };
      next = addFact(
        next,
        'blue-protocol',
        'protocolo',
        'El cuaderno registra quién cortó la luz, movió objetos y negó cada cambio. Tus iniciales corrigen las páginas.',
        'No viniste a buscar el cuaderno. Viniste a retirarlo.',
      );
      next = pushNotebook(next, {
        id: 'first-protocol',
        text: 'Mi letra corrige las instrucciones.',
      });
      if (next.memory.entries > 1) {
        next = pushNotebook(next, {
          id: 'house-remembers',
          text: 'La primera visita también terminó acá.',
        });
      }
      return next;

    case 'readNotebook':
      if (next.carrying !== 'notebook') {
        return setNotice(next, 'Sin el cuaderno, las marcas de la pared no tienen nombre.');
      }
      next = pushNotebook(next, {
        id: 'notebook-rule',
        text: '“Acompañar”: cambiar objetos y negar el cambio hasta que ella pida irse.',
      });
      if (next.scene === 'hidden') {
        next = setFlag(setFlag(next, 'registryUnderstood'), 'truthUnderstood');
        next = addFact(
          next,
          'hidden-registry',
          'anomalia',
          'La pared registra dos visitas tuyas, con el mismo recorrido y las mismas demoras.',
          'La segunda marca todavía está húmeda.',
        );
      }
      return next;

    case 'inspectKeyring':
      return addFact(
        setFlag(next, 'keyringSeen'),
        'grandmother-keyring',
        'familia',
        'La etiqueta azul fue cortada y guardada junto a una nota: «devolver a Tomás».',
        'La llave que falta fue separada para vos.',
      );

    case 'watchTV1986':
      next = addFact(
        setFlag(next, 'tv1986Seen'),
        'tv-1986-signal',
        'anomalia',
        'La señal muestra tu recorrido completo diecinueve minutos antes de que lo termines.',
        'La pantalla ya mostró el próximo cuarto.',
      );
      return pushNotebook(next, {
        id: 'tv-board',
        text: 'La grabación termina donde todavía no entré.',
      });

    case 'inspectServicePlan':
      next = addFact(
        setFlag(next, 'servicePlanSeen'),
        'service-plan',
        'protocolo',
        'El plano borrado une cada objeto alterado. Tus iniciales cierran todos los recorridos.',
        'El pasillo no fue ocultado de vos. Fue ocultado por vos.',
      );
      return pushNotebook(next, {
        id: 'service-plan',
        text: 'Mis iniciales cierran el recorrido.',
      });

    case 'inspectBehaviorProfile':
      next = addFact(
        setFlag(next, 'behaviorProfileSeen'),
        'behavior-profile',
        'conducta',
        'La etiqueta compara VISITA 02 con una visita anterior idéntica, incluida cada vacilación.',
        'No predice lo que hacés. Lo recuerda.',
      );
      return pushNotebook(next, {
        id: 'behavior-profile',
        text: 'Estoy repitiendo mis tiempos exactos.',
      });

    case 'overlayLedgerAndPlan':
      next = setFlag(setFlag(setFlag(next, 'planOverlayDone'), 'registryUnderstood'), 'truthUnderstood');
      next = addFact(
        next,
        'ledger-plan-overlay',
        'protocolo',
        'Plano y cuaderno asignan un engaño a cada cuarto. Todas las correcciones son tuyas.',
        'No estás reconstruyendo el protocolo. Estás repitiéndolo.',
      );
      return pushNotebook(next, {
        id: 'overlay-truth',
        text: 'Yo marqué el orden de cada cuarto.',
      });

    case 'openHiddenPanel':
      next = setFlag(next, 'hiddenPanelOpened');
      return setNotice(next, 'El panel cede antes de tocarlo. Del otro lado, alguien termina de soltarlo.');

    case 'inspectValuation':
      next = setFlag(next, 'valuationReady');
      next = addFact(
        next,
        'behavioral-valuation',
        'tasacion',
        'La operación registra tu firma y tu rechazo tres días antes de esta visita.',
        'El formulario no espera tu elección: mide cuánto tardás en repetirla.',
      );
      return pushNotebook(next, {
        id: 'valuation-choice',
        text: 'Hasta mi rechazo ya estaba cargado.',
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
        text: 'No es parecida. Es mi letra.',
      });
      return finish(next, 'despertar');

    case 'wait':
      return setNotice(trackIgnored(next), 'El ascensor llega. Nadie sale. En el espejo, la puerta de la casa sigue abierta.');

    default:
      return next;
  }
}

export function recoverFromCorruptSave(memory?: OriginMemory) {
  const recovered = createMemory({
    ...(memory ?? {}),
    corruptSavesRecovered: (memory?.corruptSavesRecovered ?? 0) + 1,
  });
  return setNotice(freshGame(recovered), 'La partida anterior fue descartada. La casa conservó el resto.');
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
      notice: 'El panel devuelve un golpe. Después otro, exactamente cuando retirás la mano.',
    };
  }
  return next;
}

function openingNotebook(memory: OriginMemory): NotebookLine[] {
  const lines: NotebookLine[] = [
    { id: 'cover-question', text: 'Mamá pidió retirar el cuaderno y la carpeta. Dijo que no leyera nada.' },
  ];
  if (memory.endings.length > 0) {
    lines.push({ id: 'after-entry', text: 'Volví a entrar aunque ya sé cómo termina.' });
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
  if (objectId === 'family-photo') return 'Al sacar la luz, la foto cae boca abajo. En el dorso: «Tomás volvió».';
  if (objectId === 'service-plan') return 'Dos golpes responden desde el cuarto al que apunta tu dedo.';
  if (objectId === 'behavior-sensor') return 'El punto rojo se demora exactamente lo mismo que tu pulso.';
  if (objectId === 'hidden-panel') return 'El panel devuelve un golpe. Después otro, cuando retirás la mano.';
  if (objectId === 'blue-notebook') return 'La tapa está tibia sólo donde la sostuviste en la visita anterior.';
  return 'Algo ocupa ahora el lugar donde acababas de estar.';
}

function travelTo(state: GameState, scene: Exclude<SceneId, 'ending'>): GameState {
  const previous = state.scene;
  const key = `${previous}->${scene}`;
  const visits = (state.director.sceneVisits[scene] ?? 0) + 1;
  const routeCount = (state.director.routeCounts[key] ?? 0) + 1;
  const cues = [...state.director.cues];
  if (routeCount === 3) cues.push('La puerta quedó abierta exactamente al ancho de tu cuerpo.');

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
  if (visits > 1 && sceneInfo?.ambient[0]) return `Volvés. Esta vez el ruido empieza antes que vos: ${sceneInfo.ambient[0]}.`;
  if (scene === 'hallway') return 'Todos en la foto miran a quien sostiene la cámara. Sólo vos conocés ese lado.';
  if (scene === 'living') return 'El televisor muestra la cocina. La imagen tiene diecinueve minutos de adelanto.';
  if (scene === 'kitchen') return 'La heladera se apaga cuando entrás, como si alguien necesitara oírte.';
  if (scene === 'bedroom') return 'Del llavero falta la única llave marcada con tus iniciales.';
  if (scene === 'service') return 'Los caños repiten dos golpes, pausa, uno: la forma en que llamabas.';
  if (scene === 'hidden') return `Las marcas registran dos entradas. La segunda todavía no terminó. ${finalQuestion}`;
  return 'El sobre quedó atrás, pero la cinta volvió a cerrarse.';
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
  if (scene === 'kitchen') return 'La pava cambió de hornalla. El mango apunta al azulejo que todavía no abriste.';
  if (scene === 'bedroom') return 'La foto de la mesa ahora muestra el cuarto desde donde estás parado.';
  if (scene === 'service') return 'El golpe ya no viene del panel. Viene del lado por el que llegaste.';
  if (scene === 'living') return 'En la pantalla apagada, alguien sigue sentado cuando vos te levantás.';
  return 'Un mueble deja libre el camino que ibas a elegir.';
}

function revisitCue(scene: SceneId) {
  if (scene === 'hallway') return 'La foto cambió: ahora falta la abuela y sobra una figura detrás de vos.';
  if (scene === 'kitchen') return 'La heladera dejó de sonar. Desde adentro, alguien raspa tres veces.';
  if (scene === 'bedroom') return 'La cama conserva un hundimiento reciente. Tiene tu largo exacto.';
  if (scene === 'service') return 'El panel se infla y cede, despacio, como si respirara con vos.';
  if (scene === 'hidden') return 'La pared sumó una línea con la hora actual y dejó el final en blanco.';
  return 'La casa recuerda el camino mejor que vos.';
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
      ? 'Si estás leyendo esto otra vez, no fuiste testigo. Fuiste el método.'
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
    return 'Firmás. La abuela deja de figurar como propietaria. El formulario imprime: «Tomás cumplió».';
  }
  if (ending === 'resistir') {
    return 'Tachás el precio. Debajo aparece la misma tachadura de la primera visita, en tu letra.';
  }
  if (ending === 'exponer') {
    return 'Copiás el archivo. El único destinatario es la inmobiliaria. Acabás de completarles el expediente.';
  }
  return 'Escribís tu nombre para advertir al próximo. La tinta completa la firma que encontraste al entrar.';
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
  return queueTension(next, `abandon-${state.scene}`, 'Soltás antes de terminar. Del otro lado, algo completa el movimiento por vos.');
}
