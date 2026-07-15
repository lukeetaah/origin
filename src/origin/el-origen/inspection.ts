import { InspectableObject, InspectionClue, InspectionClueId, InspectableObjectId } from './types';

export const inspectionObjects = {
  'administrator-envelope': {
    id: 'administrator-envelope',
    objectId: 'administrator-envelope',
    title: 'Sobre de la inmobiliaria',
    scene: 'door',
    model: 'document',
    primary: true,
    material: 'paper',
    instruction: 'Usá mirar: dorso y después linterna: arriba.',
    initialObservation: 'El sobre está cerrado con cinta nueva. No parece haber pasado días bajo la puerta.',
    afterClueObservation: 'El reverso fija una hora de llegada. Esto no era un favor casual.',
    clues: [
      clue('deadline-back', 'back', 'Reverso', 'La inmobiliaria llega a las 22. Te pidieron entrar antes.', '¿Por qué tanta urgencia?', 'La hora aparece al inclinar el papel.', 'readEnvelope', true, 'top'),
    ],
  },
  'family-photo': {
    id: 'family-photo',
    objectId: 'family-photo',
    title: 'Foto del aparador',
    scene: 'hallway',
    model: 'photo',
    primary: true,
    material: 'paper',
    instruction: 'Probá frente, dorso y luz de costado.',
    initialObservation: 'Una comida familiar en el pasillo. La puerta de servicio queda abierta detrás de todos.',
    afterClueObservation: 'El reverso dice que fue tomada después de la supuesta última visita.',
    changedObservation: 'Cuando volvés al pasillo, la foto queda boca abajo.',
    clues: [
      clue('service-door-open', 'front', 'Puerta abierta', 'En la foto, el acceso de servicio ya estaba abierto durante una reunión familiar.', '¿Quién usaba esa entrada?', 'La luz rebota en la abertura del fondo.', 'inspectPhoto', true, 'right'),
      clue('date-after-last-visit', 'back', 'Fecha incompatible', 'El reverso marca una fecha posterior a la última visita que la familia reconoce.', '¿Quién siguió entrando?', 'La tinta aparece sólo al iluminar de costado.', 'inspectPhoto', true, 'left'),
    ],
  },
  'kitchen-folder': {
    id: 'kitchen-folder',
    objectId: 'kitchen-folder',
    title: 'Carpeta de venta',
    scene: 'kitchen',
    model: 'folder',
    primary: true,
    canOpen: true,
    material: 'cardboard',
    instruction: 'Abrí el expediente. Leé la fecha, después tocá el sello marcado.',
    initialObservation: 'La carpeta reúne tasación, recibos y borrador de venta. Parece archivo, pero arma una versión.',
    afterClueObservation: 'La oferta baja existe antes del relato de abandono. La carpeta no ordena: acusa.',
    clues: [
      clue('sale-before-diagnosis', 'inside', 'Fecha anterior', 'La oferta baja está fechada antes del diagnóstico y usa abandono como condición del precio.', '¿La casa se abarató antes de estar vacía?', 'El sello prueba que la venta empezó antes del relato de abandono.', 'inspectFolder', false, undefined, true),
    ],
  },
  'grandmother-keyring': {
    id: 'grandmother-keyring',
    objectId: 'grandmother-keyring',
    title: 'Llavero de la abuela',
    scene: 'bedroom',
    model: 'keys',
    primary: true,
    material: 'metal',
    instruction: 'Revisá la base de las llaves con la linterna abajo.',
    initialObservation: 'Gas, terraza, vecina, ropero. Falta la llave azul que todos nombran.',
    afterClueObservation: 'Una etiqueta fue arrancada con fuerza. La marca coincide con la puerta de servicio.',
    clues: [
      clue('missing-blue-tag', 'base', 'Etiqueta cortada', 'La llave azul fue retirada del aro, no perdida.', '¿Quién la necesitaba afuera?', 'El borde cortado brilla en la base.', 'inspectKeyring', true, 'bottom'),
    ],
  },
  'blue-notebook': {
    id: 'blue-notebook',
    objectId: 'blue-notebook',
    title: 'Cuaderno azul',
    scene: 'kitchen',
    model: 'notebook',
    primary: true,
    canOpen: true,
    material: 'cloth',
    instruction: 'Abrí la tapa y después probá dorso con luz al centro.',
    initialObservation: 'La tela azul está tibia, como si hubiera estado contra una pared viva.',
    afterClueObservation: 'No es diario: es un mapa de manipulación doméstica.',
    clues: [
      clue('protocol-inside', 'inside', 'Lista de acciones', 'La abuela anotó cortes de luz, muebles movidos y golpes después de cada visita.', '¿Por qué nadie le creyó?', 'Las palabras aparecen al abrirlo.', 'takeNotebook', false, undefined, true),
      clue('pressure-script', 'back', 'Guion familiar', 'El reverso resume frases usadas para hacerla dudar de su memoria.', '¿Cuántas veces escuchaste esas frases?', 'La tinta azul reacciona a la linterna.', 'takeNotebook', true, 'center'),
    ],
  },
  'service-plan': {
    id: 'service-plan',
    objectId: 'service-plan',
    title: 'Plano bajo pintura',
    scene: 'service',
    model: 'folder',
    primary: true,
    canOpen: true,
    material: 'paper',
    instruction: 'Abrí el plano y revisá el recorrido interior.',
    initialObservation: 'El plano fue pegado bajo pintura fresca. Alguien quiso ocultar la distribución real.',
    afterClueObservation: 'El acceso de servicio no figura, pero está medido a mano.',
    clues: [
      clue('unlisted-service-route', 'inside', 'Recorrido borrado', 'El pasillo de servicio fue omitido del plano oficial y marcado a lápiz.', '¿Qué ruta no debía verse?', 'La línea aparece al desplegar el papel.', 'inspectServicePlan', false, undefined, true),
    ],
  },
  'behavior-sensor': {
    id: 'behavior-sensor',
    objectId: 'behavior-sensor',
    title: 'Caja con punto rojo',
    scene: 'service',
    model: 'sensor',
    primary: true,
    canDisassemble: true,
    material: 'plastic',
    instruction: 'Revisá la base con luz abajo.',
    initialObservation: 'No parece eléctrico de la casa. Está pegado con cinta nueva sobre caños viejos.',
    afterClueObservation: 'Registra demora, recorridos repetidos y decisiones. La casa también te mide.',
    clues: [
      clue('behavior-label-base', 'base', 'Etiqueta térmica', 'La caja registra cuánto dudás antes de tocar cada objeto.', '¿La tasación también te está evaluando?', 'La etiqueta se lee sólo desde abajo.', 'inspectBehaviorProfile', true, 'bottom'),
    ],
  },
  'valuation-folder': {
    id: 'valuation-folder',
    objectId: 'valuation-folder',
    title: 'Tasación final',
    scene: 'living',
    model: 'folder',
    primary: true,
    canOpen: true,
    material: 'cardboard',
    instruction: 'Abrí el anexo y mové la luz a la derecha.',
    initialObservation: 'El precio está escrito con birome reciente. No coincide con los metros ni con los arreglos.',
    afterClueObservation: 'El anexo baja el precio si aceptás la versión de abandono.',
    clues: [
      clue('valuation-behavior-annex', 'inside', 'Anexo conductual', 'La cifra baja cuando el informe registra docilidad, cansancio y urgencia.', '¿Qué versión vas a sacar de la casa?', 'El margen cambia bajo la luz.', 'inspectValuation', true, 'right', true),
    ],
  },
} as const satisfies Record<string, InspectableObject>;

export type RegisteredInspectableId = keyof typeof inspectionObjects;

export function getInspectableObject(id: string) {
  return inspectionObjects[id as RegisteredInspectableId];
}

export function isInspectableObject(id: string) {
  return Boolean(getInspectableObject(id));
}

export function allInspectionClues() {
  return Object.values(inspectionObjects).flatMap((object) => object.clues.map((clue) => ({ ...clue, objectId: object.objectId })));
}

export function findInspectionClue(objectId: InspectableObjectId, clueId: InspectionClueId) {
  return getInspectableObject(objectId)?.clues.find((clue) => clue.id === clueId);
}

function clue(
  id: InspectionClueId,
  side: InspectionClue['side'],
  title: string,
  fact: string,
  question: string,
  reveal: string,
  consequence: InspectionClue['consequence'],
  requiresLight = false,
  lightZone?: InspectionClue['lightZone'],
  requiresOpen = false,
): InspectionClue {
  return { id, side, title, fact, question, reveal, consequence, requiresLight, lightZone, requiresOpen };
}
