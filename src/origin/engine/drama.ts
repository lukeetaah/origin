import { Scene } from './types';

export const coreSequence = ['photo-back', 'radio-tuned', 'tv-86', 'elvira-place', 'family-photos', 'table-set', 'cassette', 'letter-open'];

export type Beat = {
  text: string;
  state?: 'threshold' | 'attention' | 'recognition' | 'confrontation' | 'decision' | 'consequence';
};

export const nextPhysicalPrompt = (has: (id: string) => boolean) => {
  if (!has('photo-back')) return 'La foto del pasillo no está derecha.';
  if (!has('radio-tuned')) return 'En el living, la radio tiene la perilla floja.';
  if (!has('tv-86')) return 'La tele espera una voz antes de mostrar algo.';
  if (!has('elvira-place')) return 'El sillón quedó mirando hacia la cocina.';
  if (!has('family-photos')) return 'En la cocina, todas las fotos miran al mismo hueco.';
  if (!has('tap-silence') || !has('mate-warm') || !has('kettle-low')) return 'La cocina todavía hace tres ruidos a la vez.';
  if (!has('table-set')) return 'El mate quedó esperando una mano.';
  if (!has('cassette')) return 'La caja del cuarto ya no parece cerrada del todo.';
  if (!has('letter-open')) return 'El sobre de Malena se ablanda al sostenerlo.';
  return 'El pasillo espera una última pasada.';
};

export const hallwayReturnLine = (sceneVisits: number, has: (id: string) => boolean) => {
  if (has('letter-open')) return 'El pasillo está igual, salvo por la luz: ahora viene desde la puerta de calle.';
  if (has('table-set') && sceneVisits > 1) return 'Al volver, la casa huele a gas apagado y yerba húmeda.';
  if (has('tv-86') && sceneVisits > 1) return 'Desde el living llega un grito viejo, cortado justo antes del abrazo.';
  if (sceneVisits > 2) return 'El piso cruje en la misma tabla. Esta vez responde más tarde.';
  return 'El pasillo reparte las habitaciones sin explicar nada.';
};

export const isCompleteEnoughForLetter = (has: (id: string) => boolean) =>
  ['radio-tuned', 'tv-86', 'elvira-place', 'family-photos', 'table-set', 'cassette'].every(has);

export const closingText = (kind: 'leave' | 'mirror', complete: boolean) => {
  if (kind === 'leave') {
    return complete
      ? 'La calle está mojada. Llevás la caja contra el pecho. En la primera esquina, la cinta vuelve a la respiración y por fin no la cortás.'
      : 'Salís con la caja. Atrás queda una canilla mal cerrada y una silla corrida. La cinta existe, pero todavía no sabe para quién.';
  }
  return complete
    ? 'El espejo tarda en empañarse. Cuando limpia, la foto tiene una persona más. Nadie mira a cámara.'
    : 'Te quedás frente al espejo. La imagen intenta acomodarte, pero la mesa todavía tiene un lugar vacío.';
};

export const sceneEntryLine = (scene: Scene, has: (id: string) => boolean, visits: number) => {
  if (scene === 'hallway') return hallwayReturnLine(visits, has);
  if (scene === 'living') return has('tv-86') ? 'El living conserva una luz de pantalla aunque la tele esté quieta.' : 'En el living, la lluvia golpea la persiana y la radio espera al costado.';
  if (scene === 'kitchen') return has('elvira-place') ? 'La cocina no está vacía: está desordenada en el orden exacto de una tarde.' : 'La cocina prende sus ruidos de siempre: agua, motor, hornalla.';
  return has('cassette') ? 'El cuarto parece más chico desde que la cinta tiene nombre.' : 'El cuarto guarda cosas en cajas bajas, como si nadie quisiera agacharse a mirar.';
};
