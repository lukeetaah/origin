import { ActionId, FlagId, Hotspot, Requirement, SceneId, SceneRecord } from './types';

const flag = (flagName: FlagId): Requirement => ({ kind: 'flag', flag: flagName });
const notFlag = (flagName: FlagId): Requirement => ({ kind: 'notFlag', flag: flagName });
const carryNotebook: Requirement = { kind: 'carry', item: 'notebook' };
const priorEnding: Requirement = { kind: 'memoryEndings', count: 1 };

function exit(id: string, label: string, rect: Hotspot['rect'], action: ActionId, exitTo: SceneId): Hotspot {
  return { id, label, verb: 'ir', rect, action, exitTo, layer: 'far', sound: 'door' };
}

export const sceneRegistry: Record<Exclude<SceneId, 'ending'>, SceneRecord> = {
  door: {
    id: 'door',
    aria: 'Puerta de un departamento antiguo. Un sobre manila quedó trabado bajo el picaporte.',
    background: { kind: 'procedural', style: 'door', width: 1920, height: 1080 },
    ambient: ['ascensor viejo detenido entre pisos', 'caños con aire', 'un televisor lejano sin palabras claras'],
    hotspots: [
      {
        id: 'administrator-envelope',
        label: 'sobre manila',
        verb: 'leer',
        rect: { x: 47, y: 62, w: 18, h: 13 },
        action: 'readEnvelope',
        layer: 'near',
        sound: 'paper',
      },
      {
        id: 'apartment-door',
        label: 'puerta del departamento',
        verb: 'entrar',
        rect: { x: 30, y: 12, w: 39, h: 71 },
        action: 'openApartmentDoor',
        exitTo: 'hallway',
        layer: 'mid',
        sound: 'door',
      },
    ],
  },

  hallway: {
    id: 'hallway',
    aria: 'Pasillo angosto con empapelado levantado, un aparador bajo y varias puertas interiores.',
    background: { kind: 'image', src: '/bg-hallway.png', width: 1024, height: 1024 },
    ambient: ['madera que trabaja', 'rueda de valija en la vereda', 'llave girando en otro piso'],
    hotspots: [
      {
        id: 'family-photo',
        label: 'foto familiar',
        verb: 'mover hacia la luz',
        rect: { x: 5, y: 62, w: 21, h: 23 },
        action: 'inspectPhoto',
        layer: 'near',
        sound: 'paper',
        holdMs: 850,
        gesture: 'hold',
      },
      exit('to-living', 'living comedor', { x: 13, y: 18, w: 23, h: 42 }, 'travelLiving', 'living'),
      exit('to-kitchen', 'cocina', { x: 58, y: 34, w: 19, h: 33 }, 'travelKitchen', 'kitchen'),
      exit('to-bedroom', 'dormitorio de Nora', { x: 78, y: 11, w: 18, h: 61 }, 'travelBedroom', 'bedroom'),
      exit('to-service', 'pasillo de servicio', { x: 36, y: 70, w: 25, h: 14 }, 'travelService', 'service'),
    ],
  },

  living: {
    id: 'living',
    aria: 'Living comedor con mesa de fórmica, radio con cassette, vitrina pesada y caja de papeles familiares.',
    background: { kind: 'image', src: '/bg-living.png', width: 1536, height: 1024 },
    ambient: ['tapizado cediendo', 'platos que vibran en una vitrina', 'colectivo frenando abajo'],
    hotspots: [
      {
        id: 'radio-cassette',
        label: 'radio con cassette',
        verb: 'sintonizar sosteniendo',
        rect: { x: 59, y: 54, w: 17, h: 16 },
        action: 'tuneRadio',
        layer: 'near',
        sound: 'radio',
        holdMs: 1200,
        gesture: 'hold',
      },
      {
        id: 'living-photo-reflection',
        label: 'foto contra el vidrio',
        verb: 'alinear reflejo',
        rect: { x: 23, y: 26, w: 18, h: 21 },
        action: 'inspectPhoto',
        layer: 'mid',
        sound: 'paper',
        holdMs: 900,
        gesture: 'drag',
      },
      {
        id: 'document-box',
        label: 'caja de documentos',
        verb: 'guardar cuaderno',
        rect: { x: 72, y: 62, w: 18, h: 17 },
        action: 'placeNotebookFamilyBox',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [carryNotebook, flag('truthUnderstood')],
        requirements: [carryNotebook, flag('truthUnderstood')],
        gesture: 'place',
      },
      exit('living-hallway', 'pasillo', { x: 1, y: 26, w: 13, h: 52 }, 'travelHallway', 'hallway'),
      exit('living-kitchen', 'cocina', { x: 83, y: 32, w: 14, h: 40 }, 'travelKitchen', 'kitchen'),
    ],
  },

  kitchen: {
    id: 'kitchen',
    aria: 'Cocina verde con azulejos viejos, heladera redondeada, pava soldada y mesa con hule.',
    background: { kind: 'image', src: '/bg-kitchen.png', width: 1536, height: 1024 },
    ambient: ['heladera a contramano', 'gota en la pileta', 'pava enfriándose de a poco'],
    hotspots: [
      {
        id: 'big-pot',
        label: 'olla grande',
        verb: 'levantar tapa',
        rect: { x: 55, y: 53, w: 15, h: 12 },
        action: 'inspectPot',
        layer: 'near',
        sound: 'pot',
      },
      {
        id: 'loose-tile',
        label: 'azulejo flojo',
        verb: 'despegar',
        rect: { x: 30, y: 46, w: 13, h: 15 },
        action: 'loosenTile',
        layer: 'mid',
        sound: 'ceramic',
        holdMs: 1100,
        gesture: 'hold',
        visibleWhen: [notFlag('notebookFound')],
      },
      {
        id: 'blue-notebook',
        label: 'cuaderno azul',
        verb: 'tomar',
        rect: { x: 32, y: 49, w: 11, h: 10 },
        action: 'takeNotebook',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [flag('tileLoose'), notFlag('notebookFound')],
        requirements: [flag('tileLoose')],
      },
      {
        id: 'read-notebook-kitchen',
        label: 'cuaderno azul',
        verb: 'abrir sobre la mesa',
        rect: { x: 21, y: 69, w: 19, h: 14 },
        action: 'readNotebook',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [carryNotebook],
        requirements: [carryNotebook],
      },
      {
        id: 'admin-envelope-final',
        label: 'sobre del consorcio',
        verb: 'poner el cuaderno adentro',
        rect: { x: 78, y: 62, w: 14, h: 15 },
        action: 'placeNotebookAdminEnvelope',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [carryNotebook, flag('truthUnderstood')],
        requirements: [carryNotebook, flag('truthUnderstood')],
        gesture: 'place',
      },
      {
        id: 'hang-notebook',
        label: 'clavo junto a la alacena',
        verb: 'escribir y colgar',
        rect: { x: 17, y: 24, w: 12, h: 19 },
        action: 'writeNameAndHangNotebook',
        layer: 'mid',
        sound: 'pencil',
        visibleWhen: [carryNotebook, flag('truthUnderstood'), priorEnding],
        requirements: [carryNotebook, flag('truthUnderstood'), priorEnding],
        holdMs: 1300,
        gesture: 'hold',
      },
      exit('kitchen-hallway', 'pasillo', { x: 0, y: 28, w: 12, h: 48 }, 'travelHallway', 'hallway'),
      exit('kitchen-service', 'pasillo de servicio', { x: 85, y: 12, w: 12, h: 65 }, 'travelService', 'service'),
    ],
  },

  bedroom: {
    id: 'bedroom',
    aria: 'Dormitorio de Nora con cama tendida, ropero oscuro, marcas de altura y una caja baja de documentos.',
    background: { kind: 'image', src: '/bg-bedroom.png', width: 1536, height: 1024 },
    ambient: ['percha golpeando dentro del ropero', 'tela que respira cuando pasa el colectivo', 'radiador frío'],
    hotspots: [
      {
        id: 'height-marks',
        label: 'marcas de altura',
        verb: 'comparar nombres',
        rect: { x: 8, y: 29, w: 15, h: 38 },
        action: 'inspectHeightMarks',
        layer: 'mid',
        sound: 'paper',
      },
      {
        id: 'nora-keyring',
        label: 'llavero de Nora',
        verb: 'mirar etiquetas',
        rect: { x: 61, y: 61, w: 13, h: 12 },
        action: 'inspectKeyring',
        layer: 'near',
        sound: 'ceramic',
      },
      {
        id: 'bedroom-document-box',
        label: 'caja familiar',
        verb: 'guardar cuaderno',
        rect: { x: 43, y: 69, w: 21, h: 14 },
        action: 'placeNotebookFamilyBox',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [carryNotebook, flag('truthUnderstood')],
        requirements: [carryNotebook, flag('truthUnderstood')],
        gesture: 'place',
      },
      exit('bedroom-hallway', 'pasillo', { x: 0, y: 19, w: 16, h: 56 }, 'travelHallway', 'hallway'),
      exit('bedroom-service', 'pasillo de servicio', { x: 82, y: 23, w: 14, h: 48 }, 'travelService', 'service'),
    ],
  },

  service: {
    id: 'service',
    aria: 'Pasillo de servicio con humedad, puerta de patio, medidor antiguo y plano pegado bajo pintura.',
    background: { kind: 'procedural', style: 'service', width: 1920, height: 1080 },
    ambient: ['viento por la rejilla', 'ascensor respirando del otro lado', 'agua dentro de la pared'],
    hotspots: [
      {
        id: 'service-plan',
        label: 'plano bajo pintura',
        verb: 'levantar borde',
        rect: { x: 49, y: 28, w: 24, h: 19 },
        action: 'inspectServicePlan',
        layer: 'mid',
        sound: 'paper',
        holdMs: 900,
        gesture: 'hold',
      },
      {
        id: 'ledger-plan-overlay',
        label: 'cuaderno y plano',
        verb: 'superponer',
        rect: { x: 33, y: 55, w: 29, h: 16 },
        action: 'overlayLedgerAndPlan',
        layer: 'near',
        sound: 'paper',
        visibleWhen: [carryNotebook, flag('servicePlanSeen')],
        requirements: [carryNotebook, flag('servicePlanSeen')],
        gesture: 'place',
      },
      {
        id: 'hidden-panel',
        label: 'panel falso',
        verb: 'correr',
        rect: { x: 73, y: 36, w: 14, h: 37 },
        action: 'openHiddenPanel',
        layer: 'mid',
        sound: 'wood',
        holdMs: 1200,
        gesture: 'hold',
        visibleWhen: [flag('planOverlayDone')],
        requirements: [flag('planOverlayDone')],
      },
      {
        ...exit('service-hidden', 'hueco de servicio', { x: 74, y: 37, w: 13, h: 36 }, 'travelHidden', 'hidden'),
        visibleWhen: [flag('hiddenPanelOpened')],
        requirements: [flag('hiddenPanelOpened')],
      },
      exit('service-hallway', 'pasillo', { x: 3, y: 20, w: 14, h: 58 }, 'travelHallway', 'hallway'),
      exit('service-kitchen', 'cocina', { x: 18, y: 71, w: 18, h: 14 }, 'travelKitchen', 'kitchen'),
    ],
  },

  hidden: {
    id: 'hidden',
    aria: 'Hueco detrás del pasillo de servicio: estantes angostos, cajas con nombres incompletos y una pared escrita a lápiz.',
    background: { kind: 'procedural', style: 'hidden', width: 1920, height: 1080 },
    ambient: ['papel contra papel', 'pared hueca', 'tráfico apagado como debajo de una frazada'],
    hotspots: [
      {
        id: 'wall-registry',
        label: 'pared escrita',
        verb: 'leer despacio',
        rect: { x: 32, y: 19, w: 33, h: 34 },
        action: 'readNotebook',
        layer: 'mid',
        sound: 'paper',
        visibleWhen: [carryNotebook],
        requirements: [carryNotebook],
      },
      {
        id: 'return-notebook',
        label: 'hueco detrás del azulejo',
        verb: 'dejar cuaderno y abrir puerta',
        rect: { x: 61, y: 61, w: 18, h: 16 },
        action: 'returnNotebookAndOpenDoor',
        layer: 'near',
        sound: 'door',
        visibleWhen: [carryNotebook, flag('truthUnderstood')],
        requirements: [carryNotebook, flag('truthUnderstood')],
        gesture: 'place',
      },
      exit('hidden-service', 'volver al pasillo', { x: 3, y: 18, w: 16, h: 62 }, 'travelService', 'service'),
    ],
  },
};

export function visibleHotspotsForScene(state: { scene: SceneId; flags: Record<string, boolean> | Partial<Record<string, boolean>>; carrying: string | null; memory: { endings: unknown[] } }) {
  if (state.scene === 'ending') return [];
  return sceneRegistry[state.scene].hotspots.filter((hotspot) => requirementsMet(state, hotspot.visibleWhen ?? []));
}

export function requirementsMet(
  state: { flags: Partial<Record<string, boolean>>; carrying: string | null; memory: { endings: unknown[] } },
  requirements: Requirement[],
) {
  return requirements.every((requirement) => {
    if (requirement.kind === 'flag') return Boolean(state.flags[requirement.flag]);
    if (requirement.kind === 'notFlag') return !state.flags[requirement.flag];
    if (requirement.kind === 'carry') return state.carrying === requirement.item;
    if (requirement.kind === 'memoryEndings') return state.memory.endings.length >= requirement.count;
    return false;
  });
}
