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
    instruction: 'La hora ya está a la vista. Tocá la marca iluminada.',
    initialObservation: 'Cinta nueva sobre papel viejo. No lo dejaron: lo prepararon para que entraras antes que la inmobiliaria.',
    afterClueObservation: 'El reverso no informa: ordena. Alguien necesitaba que llegaras antes de las 20:00.',
    clues: [
      clue('deadline-back', 'back', 'Hora impuesta', 'La inmobiliaria llega a las 20:00 y alguien te hizo entrar antes.', '¿Quién necesitaba testigo antes de la venta?', 'La hora aparece sin pedir permiso.', 'readEnvelope', true, 'top'),
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
    instruction: 'Arrastrá la foto. El frente acusa una puerta; el dorso desmiente una fecha.',
    initialObservation: 'Foto familiar en pasillo. Todos sonríen, pero la puerta de servicio queda abierta al fondo.',
    afterClueObservation: 'La foto no conserva un recuerdo: conserva una coartada mal armada.',
    changedObservation: 'Cuando volvés al pasillo, la foto queda boca abajo.',
    clues: [
      clue('service-door-open', 'front', 'Puerta abierta', 'El acceso de servicio ya estaba abierto durante la reunión familiar.', '¿Quién entraba por donde nadie miraba?', 'La luz rebota en la abertura del fondo.', 'inspectPhoto', true, 'right'),
      clue('date-after-last-visit', 'back', 'Fecha incompatible', 'El dorso fecha la foto después de la última visita declarada.', '¿Quién siguió entrando cuando todos juraban ausencia?', 'La tinta aparece sólo al iluminar de costado.', 'inspectPhoto', true, 'left'),
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
    instruction: 'Arrastrá el llavero hacia abajo. La ausencia está en la base.',
    initialObservation: 'Gas, terraza, vecina, ropero. El aro todavía guarda el tirón de una etiqueta azul.',
    afterClueObservation: 'No falta una llave: falta la ruta que permitía entrar sin pedir permiso.',
    clues: [
      clue('missing-blue-tag', 'base', 'Etiqueta cortada', 'La llave azul fue arrancada del aro, no perdida.', '¿Quién necesitaba una entrada sin testigos?', 'El borde cortado brilla en la base.', 'inspectKeyring', true, 'bottom'),
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
    instruction: 'Abrí la tapa. No leas nostalgia: leé procedimiento.',
    initialObservation: 'La tela azul está tibia. No parece escondida: parece recién soltada por la pared.',
    afterClueObservation: 'No era diario. Era manual de desgaste escrito con letra doméstica.',
    clues: [
      clue('protocol-inside', 'inside', 'Lista de acciones', 'La abuela registró luz cortada, muebles movidos y golpes tras cada visita.', '¿Por qué nadie le creyó?', 'Las palabras aparecen al abrirlo.', 'takeNotebook', false, undefined, true),
      clue('pressure-script', 'back', 'Guion familiar', 'El dorso lista frases usadas para hacerla dudar de su memoria.', '¿Cuántas veces escuchaste esas frases?', 'La tinta azul reacciona a la linterna.', 'takeNotebook', true, 'center'),
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
    instruction: 'Abrí el plano. La casa oficial no coincide con la casa usada.',
    initialObservation: 'Pintura fresca sobre papel viejo. El plano estaba oculto como una segunda piel.',
    afterClueObservation: 'El acceso de servicio fue borrado del papel, pero medido a mano en la pared.',
    clues: [
      clue('unlisted-service-route', 'inside', 'Recorrido borrado', 'El pasillo de servicio falta del plano oficial y aparece marcado a mano.', '¿Qué ruta no debía existir?', 'La línea aparece al desplegar el papel.', 'inspectServicePlan', false, undefined, true),
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
    instruction: 'Arrastrá hacia la base y seguí el punto rojo. No es un adorno.',
    initialObservation: 'Caja nueva sobre caños viejos. El punto rojo no parpadea: espera.',
    afterClueObservation: 'No registra fantasmas. Registra tu conducta dentro de la casa.',
    clues: [
      clue('behavior-label-base', 'base', 'Etiqueta térmica', 'La caja registra cuánto dudás antes de tocar cada prueba.', '¿La tasación también te está evaluando?', 'La etiqueta se lee sólo desde abajo.', 'inspectBehaviorProfile', true, 'bottom'),
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
    instruction: 'Abrí el anexo. El precio cambia cuando aceptás una versión.',
    initialObservation: 'Birome reciente, cifra baja, margen demasiado limpio. El precio parece escuchar.',
    afterClueObservation: 'El anexo premia cansancio y docilidad. No tasan la casa: tasan tu obediencia.',
    clues: [
      clue('valuation-behavior-annex', 'inside', 'Anexo conductual', 'La cifra baja cuando el informe registra docilidad y urgencia.', '¿Qué versión vas a sacar de la casa?', 'El margen cambia bajo la luz.', 'inspectValuation', true, 'right', true),
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
