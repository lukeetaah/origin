import { FactKind, GameState } from './types';

const titles: Record<FactKind, string> = {
  tramite: 'lo que el trámite intenta volver normal',
  familia: 'lo que la familia acomodó para parecer cuidado',
  protocolo: 'el método escondido en la casa',
  conducta: 'cómo te está midiendo la operación',
  tasacion: 'el precio como arma',
  anomalia: 'lo que la casa sabe antes de tiempo',
  consecuencia: 'lo que queda después',
};

export function buildNotebook(state: GameState) {
  const factsByKind = state.facts.reduce<Partial<Record<FactKind, string[]>>>((acc, fact) => {
    acc[fact.kind] = [...(acc[fact.kind] ?? []), fact.text];
    return acc;
  }, {});

  const sections = (Object.keys(titles) as FactKind[])
    .map((kind) => ({
      kind,
      title: titles[kind],
      lines: factsByKind[kind] ?? [],
    }))
    .filter((section) => section.lines.length > 0);

  const mutations = [
    state.flags.ledgerDecoded ? '“Cuidado” queda tachado; debajo se lee “administración de desgaste”.' : '',
    state.flags.behaviorProfileSeen ? 'Aparece una columna nueva: docilidad, duda, demora, precio.' : '',
    state.flags.planOverlayDone ? 'Las habitaciones empiezan a parecer posiciones de un tablero viejo.' : '',
    state.flags.valuationReady ? 'La carpeta de tasación ya no calcula metros: calcula obediencia.' : '',
    state.memory.endings.length > 0 ? 'Una entrada anterior dejó presión en el margen izquierdo.' : '',
    state.flags.nameWritten ? 'La última línea ya no está vacía.' : '',
  ].filter(Boolean);

  return {
    heading: 'Libreta azul',
    hand: state.flags.notebookFound
      ? 'Letra inclinada, tinta lavada por vapor de cocina. No guarda nostalgia: guarda procedimiento, daño y precio.'
      : 'Todavía falta encontrarla. La casa sólo muestra trámite hasta que aparece el método.',
    lines: state.notebook,
    mutations,
    sections,
  };
}
