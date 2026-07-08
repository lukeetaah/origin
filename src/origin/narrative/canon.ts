// Canon: the thematic spine of ORIGIN
// A room that remembers poorly. Objects that witnessed something.
// A door that may not lead outside. A photograph that looks back.

export const CANON = {
  premise: 'Una habitación que recuerda mal un hecho que nadie terminó de reconstruir.',
  
  themes: [
    'La memoria como espacio habitable',
    'Los objetos como testigos poco confiables',
    'La atención como forma de alteración',
    'El umbral entre observar y ser observado',
  ],

  roomDescription: `
    La habitación no tiene dimensiones fijas. 
    Es tan grande como la atención que se le presta.
    Cuando nadie mira, podría no existir.
  `,

  objectEssences: {
    door: 'No es una salida. Es una pregunta que cambia según quién la mira.',
    table: 'Sostiene lo que alguien dejó. No lo que alguien trajo.',
    photograph: 'No registra un momento. Registra una demora.',
    letter: 'Las palabras cambian si fueron ignoradas demasiado tiempo.',
    wall: 'Lo que separa no es la pared. Es lo que suena detrás.',
    wallSound: 'El sonido no viene de afuera. Viene de antes.',
    light: 'La luz no ilumina. Decide qué se ve.',
  },
} as const;
