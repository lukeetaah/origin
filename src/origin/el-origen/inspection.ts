import { InspectableObject, InspectionClue, InspectionClueId, InspectableObjectId } from './types';

export const inspectionObjects = {
  'administrator-envelope': object({
    id: 'administrator-envelope', title: 'Sobre de la inmobiliaria', scene: 'door', model: 'document', material: 'paper',
    pattern: 'open', actionLabel: 'Abrir', instruction: 'Abrí el sobre.',
    initialObservation: 'La cinta está fresca. Debajo de tu nombre alguien escribió «segunda visita».',
    afterClueObservation: 'El pago salió de una cuenta a tu nombre ocho días después de internarla.',
    clue: clue('utility-after-admission', 'inside', 'Pago a tu nombre', 'Mantuvieron la casa encendida para esta visita y cargaron el pago a tu nombre.', 'readEnvelope', true),
  }),
  'family-photo': object({
    id: 'family-photo', title: 'Foto del aparador', scene: 'hallway', model: 'photo', material: 'paper',
    pattern: 'reveal', actionLabel: 'Mantené sobre la fecha', instruction: 'Mantené sobre la fecha.',
    initialObservation: 'La puerta del fondo está abierta. En el vidrio aparece quien sostiene la cámara.',
    afterClueObservation: 'La fecha es de ayer. La figura del vidrio lleva tu campera.',
    changedObservation: 'Al volver, la foto está boca abajo. El vidrio sigue mostrando tu cara.',
    clue: clue('recent-house-photo', 'front', 'Detrás de la cámara', 'La foto es de ayer. La casa estaba abierta y vos estabas adentro.', 'inspectPhoto'),
  }),
  'kitchen-folder': object({
    id: 'kitchen-folder', title: 'Carpeta de venta', scene: 'kitchen', model: 'folder', material: 'cardboard',
    pattern: 'open', actionLabel: 'Abrir carpeta', instruction: 'Abrí la carpeta.',
    initialObservation: 'La oferta fue impresa antes de que la ambulancia llegara.',
    afterClueObservation: 'Tu autorización ocupa la página anterior. La firma no es una copia.',
    clue: clue('sale-before-admission', 'inside', 'Autorización anticipada', 'Ofertaron antes de internarla. La autorización de ingreso lleva tu firma.', 'inspectFolder', true),
  }),
  'grandmother-keyring': object({
    id: 'grandmother-keyring', title: 'Llavero de la abuela', scene: 'bedroom', model: 'keys', material: 'metal',
    pattern: 'observe', actionLabel: 'Mirar el aro', instruction: 'Mirá el aro.',
    initialObservation: 'Cada puerta tiene una etiqueta. Una fue cortada con apuro.',
    afterClueObservation: 'Del hilo azul cuelga un papel: «devolver a Tomás».',
    clue: clue('missing-blue-tag', 'front', 'Llave separada', 'La llave del cuarto oculto fue separada para vos.', 'inspectKeyring'),
  }),
  'blue-notebook': object({
    id: 'blue-notebook', title: 'Cuaderno azul', scene: 'kitchen', model: 'notebook', material: 'cloth',
    pattern: 'open', actionLabel: 'Abrir cuaderno', instruction: 'Abrí el cuaderno.',
    initialObservation: 'No tiene polvo. La tela conserva la marca de una mano izquierda.',
    afterClueObservation: 'Tus iniciales corrigen las instrucciones que hicieron dudar a tu abuela.',
    clue: clue('pressure-script', 'inside', 'Tus correcciones', 'El protocolo familiar está escrito y corregido con tu letra.', 'takeNotebook', true),
  }),
  'service-plan': object({
    id: 'service-plan', title: 'Plano bajo pintura', scene: 'service', model: 'folder', material: 'paper',
    pattern: 'open', actionLabel: 'Desplegar', instruction: 'Desplegá el plano.',
    initialObservation: 'La pintura está blanda. Alguien intentó taparlo después de tu llegada.',
    afterClueObservation: 'La ruta une cada objeto alterado. Tus iniciales cierran todos los recorridos.',
    clue: clue('unlisted-service-route', 'inside', 'Recorrido firmado', 'El plano asigna cada engaño a una habitación y todos terminan en vos.', 'inspectServicePlan', true),
  }),
  'behavior-sensor': object({
    id: 'behavior-sensor', title: 'Caja con punto rojo', scene: 'service', model: 'sensor', material: 'plastic',
    pattern: 'reveal', actionLabel: 'Mantené sobre la etiqueta', instruction: 'Mantené sobre la etiqueta.',
    initialObservation: 'La caja imprime una línea cada vez que dudás antes de tocar algo.',
    afterClueObservation: 'La etiqueta no predice esta visita: repite tus tiempos de la anterior.',
    clue: clue('second-visit-profile', 'front', 'Misma demora', 'Visita 02 repite exactamente las decisiones y demoras de Visita 01.', 'inspectBehaviorProfile'),
  }),
  'valuation-folder': object({
    id: 'valuation-folder', title: 'Tasación final', scene: 'living', model: 'folder', material: 'cardboard',
    pattern: 'open', actionLabel: 'Abrir anexo', instruction: 'Abrí el anexo.',
    initialObservation: 'Tu nombre figura como vendedor. Abajo dice: «conducta ya verificada».',
    afterClueObservation: 'La firma coincide. El casillero «se resistirá» también estaba marcado.',
    clue: clue('preloaded-valuation', 'inside', 'Respuesta registrada', 'La venta registró de antemano hasta la forma en que ibas a negarte.', 'inspectValuation', true),
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
  return { id, side, title, fact, question: questionFor(id), reveal: fact, consequence, requiresOpen };
}

function questionFor(id: string) {
  if (id === 'utility-after-admission') return '¿Por qué pagaste una casa que decías cerrada?';
  if (id === 'recent-house-photo') return '¿Quién estaba realmente detrás de la cámara?';
  if (id === 'sale-before-admission') return '¿Qué autorizaste antes de que ella pudiera negarse?';
  if (id === 'missing-blue-tag') return '¿Qué abriste en la primera visita?';
  if (id === 'pressure-script') return '¿Cuántas frases del cuaderno dijiste vos?';
  if (id === 'unlisted-service-route') return '¿Por qué todos los recorridos terminan en tus iniciales?';
  if (id === 'second-visit-profile') return '¿Está prediciendo lo que hacés o recordándolo?';
  return 'Si ya sabía que ibas a negarte, ¿qué opción queda?';
}
