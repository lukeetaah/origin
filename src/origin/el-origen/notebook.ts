import { FactKind, GameState } from './types';

const titles: Record<FactKind, string> = {
  encargo: 'lo que piden desde afuera',
  contradiccion: 'lo que no coincide',
  registro: 'lo que Nora dejó comprobable',
  cuidado: 'lo que sostuvo la casa',
  objeto: 'objetos que saben más que el papel',
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
    state.flags.ledgerDecoded ? '“gastos” queda tachado; debajo se lee “origen”.' : '',
    state.flags.planOverlayDone ? 'Las columnas empiezan a parecer medidas de habitaciones.' : '',
    state.memory.endings.length > 0 ? 'Una entrada anterior dejó presión en el margen izquierdo.' : '',
    state.flags.nameWritten ? 'La última línea ya no está vacía.' : '',
  ].filter(Boolean);

  return {
    heading: 'Cuaderno azul de Nora',
    hand: state.flags.notebookFound
      ? 'Letra inclinada, tinta azul lavada por vapor de cocina. No ordena nostalgia: ata aportes, noches y llaves.'
      : 'Todavía falta encontrarla.',
    lines: state.notebook,
    mutations,
    sections,
  };
}
