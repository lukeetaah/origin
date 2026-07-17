import { InspectableObject, InspectionClue, InspectionClueId, InspectableObjectId } from './types';

export const inspectionObjects = {
  'administrator-envelope': object({
    id: 'administrator-envelope', title: 'Sobre de la inmobiliaria', scene: 'door', model: 'document', material: 'paper',
    pattern: 'open', actionLabel: 'Abrir', instruction: 'Abrí el sobre.',
    initialObservation: 'Está dirigido a vos. La cinta es nueva.',
    afterClueObservation: 'El recibo queda fuera del sobre.',
    clue: clue('utility-after-admission', 'inside', 'Pago posterior', 'Pagaron la luz después de internarla.', 'readEnvelope', true),
  }),
  'family-photo': object({
    id: 'family-photo', title: 'Foto del aparador', scene: 'hallway', model: 'photo', material: 'paper',
    pattern: 'reveal', actionLabel: 'Mantené sobre la fecha', instruction: 'Mantené sobre la fecha.',
    initialObservation: 'La puerta está abierta al fondo.',
    afterClueObservation: 'La fecha queda visible bajo la foto.',
    changedObservation: 'Al volver, la foto aparece boca abajo.',
    clue: clue('recent-house-photo', 'front', 'Fecha reciente', 'La foto es reciente. La casa no estaba cerrada.', 'inspectPhoto'),
  }),
  'kitchen-folder': object({
    id: 'kitchen-folder', title: 'Carpeta de venta', scene: 'kitchen', model: 'folder', material: 'cardboard',
    pattern: 'open', actionLabel: 'Abrir carpeta', instruction: 'Abrí la carpeta.',
    initialObservation: 'La oferta ya estaba preparada.',
    afterClueObservation: 'La carpeta queda abierta en esa página.',
    clue: clue('sale-before-admission', 'inside', 'Oferta anticipada', 'La oferta precede a la internación.', 'inspectFolder', true),
  }),
  'grandmother-keyring': object({
    id: 'grandmother-keyring', title: 'Llavero de la abuela', scene: 'bedroom', model: 'keys', material: 'metal',
    pattern: 'observe', actionLabel: 'Mirar el aro', instruction: 'Mirá el aro.',
    initialObservation: 'Las etiquetas nombran cada puerta.',
    afterClueObservation: 'El corte todavía brilla en el aro.',
    clue: clue('missing-blue-tag', 'front', 'Etiqueta cortada', 'La llave azul fue arrancada.', 'inspectKeyring'),
  }),
  'blue-notebook': object({
    id: 'blue-notebook', title: 'Cuaderno azul', scene: 'kitchen', model: 'notebook', material: 'cloth',
    pattern: 'open', actionLabel: 'Abrir cuaderno', instruction: 'Abrí el cuaderno.',
    initialObservation: 'Estaba oculto, pero sin polvo.',
    afterClueObservation: 'La página queda marcada con tu nombre.',
    clue: clue('pressure-script', 'inside', 'Guion familiar', 'La familia anotó cómo hacerla dudar.', 'takeNotebook', true),
  }),
  'service-plan': object({
    id: 'service-plan', title: 'Plano bajo pintura', scene: 'service', model: 'folder', material: 'paper',
    pattern: 'open', actionLabel: 'Desplegar', instruction: 'Desplegá el plano.',
    initialObservation: 'La pintura todavía está blanda.',
    afterClueObservation: 'La ruta borrada coincide con la pared.',
    clue: clue('unlisted-service-route', 'inside', 'Recorrido borrado', 'El acceso de servicio fue borrado.', 'inspectServicePlan', true),
  }),
  'behavior-sensor': object({
    id: 'behavior-sensor', title: 'Caja con punto rojo', scene: 'service', model: 'sensor', material: 'plastic',
    pattern: 'reveal', actionLabel: 'Mantené sobre la etiqueta', instruction: 'Mantené sobre la etiqueta.',
    initialObservation: 'La caja imprime al detectar movimiento.',
    afterClueObservation: 'La etiqueta sigue saliendo de la caja.',
    clue: clue('second-visit-profile', 'front', 'Segunda visita', 'Registró tu segunda visita y predijo la cocina.', 'inspectBehaviorProfile'),
  }),
  'valuation-folder': object({
    id: 'valuation-folder', title: 'Tasación final', scene: 'living', model: 'folder', material: 'cardboard',
    pattern: 'open', actionLabel: 'Abrir anexo', instruction: 'Abrí el anexo.',
    initialObservation: 'Tu nombre ya figura en la tapa.',
    afterClueObservation: 'El anexo conserva una firma idéntica.',
    clue: clue('preloaded-valuation', 'inside', 'Operación previa', 'La operación fue registrada antes de tu llegada.', 'inspectValuation', true),
  }),
} as const satisfies Record<string, InspectableObject>;

export type RegisteredInspectableId = keyof typeof inspectionObjects;

export function getInspectableObject(id: string) {
  return inspectionObjects[id as RegisteredInspectableId];
}

export function isInspectableObject(id: string) {
  return Boolean(getInspectableObject(id));
}

export function allInspectionClues() {
  return Object.values(inspectionObjects).flatMap((item) => item.clues.map((itemClue) => ({ ...itemClue, objectId: item.objectId })));
}

export function findInspectionClue(objectId: InspectableObjectId, clueId: InspectionClueId) {
  return getInspectableObject(objectId)?.clues.find((itemClue) => itemClue.id === clueId);
}

type ObjectInput = Omit<InspectableObject, 'objectId' | 'primary' | 'clues' | 'canOpen'> & { clue: InspectionClue };

function object(input: ObjectInput): InspectableObject {
  const { clue: itemClue, ...rest } = input;
  return {
    ...rest,
    objectId: input.id,
    primary: true,
    canOpen: input.pattern === 'open',
    clues: [itemClue],
  };
}

function clue(id: string, side: InspectionClue['side'], title: string, fact: string, consequence: InspectionClue['consequence'], requiresOpen = false): InspectionClue {
  return { id, side, title, fact, question: '', reveal: fact, consequence, requiresOpen };
}
