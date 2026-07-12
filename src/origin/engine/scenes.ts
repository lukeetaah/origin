import { Scene } from './types';

export type InteractionKind = 'tap' | 'hold' | 'drag' | 'exit';

export type Region = {
  id: string;
  label: string;
  kind: InteractionKind;
  rect: { x: number; y: number; w: number; h: number };
  to?: Scene;
};

export type SceneDefinition = {
  id: Scene;
  title: string;
  image: string;
  size: { width: number; height: number };
  regions: Region[];
};

const size = { width: 1000, height: 1000 };

export const scenes: Record<Scene, SceneDefinition> = {
  hallway: {
    id: 'hallway',
    title: 'pasillo',
    image: '/bg-hallway.png',
    size,
    regions: [
      { id: 'photo', label: 'foto del pasillo', kind: 'hold', rect: { x: 40, y: 520, w: 210, h: 200 } },
      { id: 'lamp', label: 'aplique', kind: 'tap', rect: { x: 680, y: 180, w: 130, h: 160 } },
      { id: 'door-living', label: 'umbral al living', kind: 'exit', to: 'living', rect: { x: 100, y: 140, w: 240, h: 520 } },
      { id: 'door-kitchen', label: 'umbral a la cocina', kind: 'exit', to: 'kitchen', rect: { x: 600, y: 330, w: 140, h: 420 } },
      { id: 'door-bedroom', label: 'umbral al cuarto', kind: 'exit', to: 'bedroom', rect: { x: 870, y: 80, w: 130, h: 840 } },
      { id: 'exit', label: 'puerta de calle', kind: 'exit', rect: { x: 500, y: 370, w: 160, h: 310 } },
    ],
  },
  living: {
    id: 'living',
    title: 'living',
    image: '/bg-living.png',
    size,
    regions: [
      { id: 'exit-hallway', label: 'pasillo', kind: 'exit', to: 'hallway', rect: { x: 0, y: 0, w: 95, h: 1000 } },
      { id: 'living-window', label: 'ventana con persiana', kind: 'tap', rect: { x: 100, y: 80, w: 400, h: 320 } },
      { id: 'chair', label: 'sillón de Elvira', kind: 'hold', rect: { x: 40, y: 430, w: 400, h: 390 } },
      { id: 'television', label: 'televisor', kind: 'tap', rect: { x: 550, y: 340, w: 210, h: 270 } },
      { id: 'radio', label: 'radio Spica', kind: 'drag', rect: { x: 780, y: 390, w: 190, h: 170 } },
    ],
  },
  kitchen: {
    id: 'kitchen',
    title: 'cocina',
    image: '/bg-kitchen.png',
    size,
    regions: [
      { id: 'exit-hallway', label: 'pasillo', kind: 'exit', to: 'hallway', rect: { x: 0, y: 0, w: 105, h: 1000 } },
      { id: 'family-photos', label: 'fotos en la pared', kind: 'tap', rect: { x: 30, y: 70, w: 190, h: 220 } },
      { id: 'tap', label: 'canilla', kind: 'hold', rect: { x: 380, y: 400, w: 120, h: 100 } },
      { id: 'kettle', label: 'pava y hornalla', kind: 'tap', rect: { x: 520, y: 420, w: 160, h: 150 } },
      { id: 'mate', label: 'mate en la mesa', kind: 'hold', rect: { x: 190, y: 620, w: 130, h: 160 } },
      { id: 'fridge', label: 'heladera Siam', kind: 'tap', rect: { x: 780, y: 280, w: 190, h: 580 } },
    ],
  },
  bedroom: {
    id: 'bedroom',
    title: 'cuarto',
    image: '/bg-bedroom.png',
    size,
    regions: [
      { id: 'exit-hallway', label: 'pasillo', kind: 'exit', to: 'hallway', rect: { x: 0, y: 0, w: 105, h: 1000 } },
      { id: 'mirror', label: 'espejo del ropero', kind: 'hold', rect: { x: 580, y: 200, w: 170, h: 400 } },
      { id: 'box', label: 'caja de casetes', kind: 'tap', rect: { x: 540, y: 620, w: 270, h: 190 } },
      { id: 'letter', label: 'sobre de Malena', kind: 'hold', rect: { x: 570, y: 720, w: 110, h: 70 } },
      { id: 'bed', label: 'cama de los primos', kind: 'tap', rect: { x: 30, y: 340, w: 440, h: 500 } },
      { id: 'bedroom-window', label: 'ventana al patio', kind: 'tap', rect: { x: 900, y: 160, w: 100, h: 430 } },
    ],
  },
};

export const styleForRegion = (region: Region) => ({
  left: `${region.rect.x / 10}%`,
  top: `${region.rect.y / 10}%`,
  width: `${region.rect.w / 10}%`,
  height: `${region.rect.h / 10}%`,
});
