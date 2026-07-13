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

const finalQuestion = '¿Quién tiene derecho a decidir qué versión de esta casa se vuelve oficial?';

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
    runId: `elda-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    started: false,
    scene: 'door',
    carrying: null,
    flags: {},
    facts: [],
    notebook: openingNotebook(memory),
    notice: '¿Dónde está la libreta azul de Elda?',
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
    return { ok: false, reason: 'La casa todavía no guardó una entrada anterior con suficiente peso.' };
  }
  if (hotspot.requirements?.some((requirement) => requirement.kind === 'carry')) {
    return { ok: false, reason: 'Ese lugar pide que tengas la libreta en la mano.' };
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
      notice: 'Encontrá la libreta azul antes de que lleguen a vaciar. Y no se la des al administrador.',
    });
  }

  const targetScene = routeByAction[action];
  if (targetScene) return travelTo(next, targetScene);

  switch (action) {
    case 'readEnvelope':
      return addFact(
        setFlag(next, 'envelopeRead'),
        'administrator-order',
        'encargo',
        'El sobre exige entregar cualquier papel de propiedad antes de que retiren los muebles.',
        'El administrador dejó un inventario ajeno: muebles, papeles, llaves. La libreta azul no aparece nombrada.',
      );

    case 'inspectPhoto':
      next = addFact(
        setFlag(next, 'photoMismatch'),
        'photo-absence',
        'contradiccion',
        'La foto familiar conserva el borde de alguien recortado; el vidrio refleja una silla ocupada que no está en la imagen.',
        'La foto no estaba mal cortada: alguien aprendió a quedar afuera del cuadro.',
      );
      return pushNotebook(next, {
        id: 'photo-gap',
        text: 'Foto familiar: si la inclino contra el vidrio, aparece una silla donde nadie quiso firmar presencia.',
      });

    case 'tuneRadio':
      next = addFact(
        setFlag(next, 'radioTuned'),
        'radio-kitchen-line',
        'cuidado',
        'La cinta repite una cuenta de platos, no una canción: “uno para Doña Elda, dos para los chicos, otro por si cae alguien”.',
        'La perilla encuentra una voz gastada: no cuenta secretos, cuenta platos.',
      );
      return pushNotebook(next, {
        id: 'radio-plates',
        text: 'La radio guarda una lista de comida como si fuera un parte meteorológico.',
      });

    case 'inspectPot':
      next = addFact(
        setFlag(next, 'potRemembered'),
        'big-pot',
        'objeto',
        'La olla tiene marcas de reparación y sal en los bordes: cocinó más de lo que una familia podía comer sola.',
        'La olla no está sucia: está usada de una manera que el inventario no sabe medir.',
      );
      return pushNotebook(next, {
        id: 'pot-scale',
        text: 'Olla grande: cuando la casa no alcanzaba, Elda agrandaba la mesa.',
      });

    case 'loosenTile':
      return setNotice(setFlag(next, 'tileLoose'), 'El azulejo cede con una queja corta. Atrás hay tela azul y olor a harina vieja.');

    case 'takeNotebook':
      next = setFlag(setFlag(setFlag(next, 'notebookFound'), 'recipeDecoded'), 'tileLoose');
      next = { ...next, carrying: 'notebook' };
      next = addFact(
        next,
        'blue-notebook',
        'registro',
        'La libreta azul no junta recetas: usa cantidades, iniciales y sustituciones para registrar quién tuvo lugar en la casa.',
        'La libreta azul de Elda aparece detrás del azulejo, envuelta en una bolsa de pan.',
      );
      next = pushNotebook(next, {
        id: 'first-recipe',
        text: 'Guiso para ocho: donde dice papa, leer cama; donde dice sal, leer documento; donde dice repetir, leer quedarse.',
      });
      if (next.memory.entries > 1) {
        next = pushNotebook(next, {
          id: 'house-remembers',
          text: 'Hay una marca que no hice hoy. La casa recuerda una entrada anterior.',
        });
      }
      return next;

    case 'readNotebook':
      if (next.carrying !== 'notebook') {
        return setNotice(next, 'La pared enumera nombres incompletos. Falta la libreta para entender el orden.');
      }
      next = pushNotebook(next, {
        id: 'notebook-rule',
        text: 'No eran recetas para comer mejor. Eran formas de que alguien siguiera existiendo sin figurar.',
      });
      return setNotice(next, 'La letra cambia de presión cuando llega a los nombres sin documento. Ahí Elda no explica: protege.');

    case 'inspectHeightMarks':
      next = addFact(
        setFlag(next, 'heightMarksRead'),
        'height-marks',
        'contradiccion',
        'Las marcas de altura mezclan apellidos, apodos y cruces. Algunas no coinciden con ninguna partida familiar.',
        'En el marco de la puerta hay chicos que crecieron sin entrar en la carpeta de familia.',
      );
      return pushNotebook(next, {
        id: 'height-marks',
        text: 'Marco del dormitorio: crecer en una casa también deja registro, aunque no deje papel.',
      });

    case 'inspectKeyring':
      return addFact(
        setFlag(next, 'keyringSeen'),
        'elda-keyring',
        'objeto',
        'El llavero de Elda tiene etiquetas domésticas, no legales: patio, vecina, gas, pieza fría, volver tarde.',
        'Las llaves no abren propiedades. Abren costumbres.',
      );

    case 'inspectServicePlan':
      next = addFact(
        setFlag(next, 'servicePlanSeen'),
        'service-plan',
        'objeto',
        'El plano del edificio tiene una línea raspada detrás de la cocina: un espacio que no figura en la copia sellada.',
        'Bajo la pintura aparece un plano con una pared dibujada dos veces.',
      );
      return pushNotebook(next, {
        id: 'service-plan',
        text: 'Plano bajo pintura: si una pared se dibuja dos veces, una de las dos está mintiendo.',
      });

    case 'overlayRecipeAndPlan':
      next = setFlag(setFlag(next, 'planOverlayDone'), 'registryUnderstood');
      next = setFlag(next, 'truthUnderstood');
      next = addFact(
        next,
        'recipe-plan-overlay',
        'registro',
        'Superpuestas, las cantidades de la receta coinciden con piezas, camas y turnos. La libreta es un plano de refugio.',
        'La receta encaja sobre el plano como si siempre hubiera sido una llave.',
      );
      return pushNotebook(next, {
        id: 'overlay-truth',
        text: 'La receta no describe comida: distribuye techo, silencio y riesgo.',
      });

    case 'openHiddenPanel':
      next = setFlag(next, 'hiddenPanelOpened');
      return setNotice(next, 'El panel corre apenas. El hueco no estaba escondido por miedo al robo, sino al archivo.');

    case 'placeNotebookAdminEnvelope':
      return finish(next, 'administrativa');

    case 'placeNotebookFamilyBox':
      return finish(next, 'familiar');

    case 'returnNotebookAndOpenDoor':
      next = setFlag(next, 'doorLeftOpen');
      return finish(next, 'comunitaria');

    case 'writeNameAndHangNotebook':
      next = setFlag(next, 'nameWritten');
      next = pushNotebook(next, {
        id: 'last-empty-line',
        text: 'Última línea: dejo mi nombre donde antes sólo había espacio para negar el costo.',
      });
      return finish(next, 'cuidadora');

    case 'wait':
      return setNotice(trackIgnored(next), 'Esperar no adelanta a nadie. Pero hace sonar la casa: heladera, caños, ascensor, vecinos.');

    default:
      return next;
  }
}

export function recoverFromCorruptSave(memory?: OriginMemory) {
  const recovered = createMemory({
    ...(memory ?? {}),
    corruptSavesRecovered: (memory?.corruptSavesRecovered ?? 0) + 1,
  });
  return setNotice(freshGame(recovered), 'La partida guardada estaba dañada. La casa abrió una entrada limpia sin mezclar recuerdos.');
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
    { id: 'cover-question', text: '¿Dónde está la libreta azul de Elda?' },
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
  const contradictions = kind === 'contradiccion' && !state.memory.contradictions.includes(id)
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
  if (scene === 'hallway') return 'El pasillo ordena la casa como una frase: cada puerta promete una versión distinta.';
  if (scene === 'living') return 'El living comedor conserva visitas aunque nadie se siente.';
  if (scene === 'kitchen') return 'La cocina no parece abandonada: parece interrumpida.';
  if (scene === 'bedroom') return 'El dormitorio de Elda está demasiado prolijo para haber terminado.';
  if (scene === 'service') return 'El pasillo de servicio tiene una humedad con forma de mapa.';
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
    deliveredNotebook: state.memory.deliveredNotebook || ending === 'administrativa' || ending === 'familiar',
    hiddenNotebook: state.memory.hiddenNotebook || ending === 'comunitaria',
    returnedNotebook: state.memory.returnedNotebook || ending === 'comunitaria',
    lastNotebookLine: ending === 'cuidadora'
      ? 'La libreta queda colgada en la cocina. Cuidar también deja deuda.'
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
  if (ending === 'administrativa') {
    return 'La libreta dentro del sobre prueba que hubo una red de cuidado. También entrega los nombres que Elda había vuelto borrosos para protegerlos.';
  }
  if (ending === 'familiar') {
    return 'La caja familiar conserva la libreta como herencia privada. La casa gana una verdad íntima y pierde su fuerza como refugio para otros.';
  }
  if (ending === 'comunitaria') {
    return 'La libreta vuelve al hueco y la puerta queda sin trabar. Nadie recibe un expediente completo; alguien, tal vez, todavía encuentra lugar.';
  }
  return 'Escribís un nombre en la última línea y colgás la libreta en la cocina. La casa ya no pide testigo: pide relevo.';
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
