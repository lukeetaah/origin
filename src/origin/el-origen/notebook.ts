import { FactKind, GameState } from './types';

const titles: Record<FactKind, string> = {
  tramite: 'trámite',
  familia: 'familia',
  protocolo: 'protocolo',
  conducta: 'conducta',
  tasacion: 'tasación',
  anomalia: 'anomalía',
  consecuencia: 'consecuencia',
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

  const cards = state.evidence.slice(-5).map((item) => ({
    id: item.id,
    kicker: item.icon,
    text: item.fact,
    question: item.question,
  }));

  const fallbackCards = [
    state.flags.keyringSeen ? { id: 'key', kicker: 'llaves', text: 'La azul no está.', question: '¿Quién la sacó?' } : null,
    state.flags.notebookFound ? { id: 'notebook', kicker: 'cuaderno', text: 'La abuela anotaba intrusiones.', question: '¿Quién la hizo dudar?' } : null,
    state.flags.fridgeChecked ? { id: 'fridge', kicker: 'heladera', text: 'No era abandono.', question: '¿Quién preparó la escena?' } : null,
    state.flags.planOverlayDone ? { id: 'overlay', kicker: 'plano', text: 'Plano y libreta encajan.', question: '¿Qué repite la casa?' } : null,
  ].filter((card): card is { id: string; kicker: string; text: string; question: string } => Boolean(card));

  const visibleCards = cards.length > 0 ? cards : fallbackCards.slice(0, 5);
  const connections = visibleCards.slice(0, 5).map((card, index) => ({
    id: card.id,
    label: card.kicker,
    text: card.text,
    question: card.question,
    linksTo: index > 0 ? visibleCards[index - 1].id : null,
  }));

  const mutations = [
    state.flags.ledgerDecoded ? '"Cuidado" → "desgaste".' : '',
    state.flags.objectMovedAfterInspection ? 'Una foto cambió cuando quedó fuera de luz.' : '',
    state.flags.behaviorProfileSeen ? 'Nueva columna: demora / duda / precio.' : '',
    state.flags.planOverlayDone ? 'Plano + libreta: encajan.' : '',
    state.flags.valuationReady ? 'La carpeta cambió de cifra.' : '',
    state.memory.endings.length > 0 ? 'La casa recuerda otra entrada.' : '',
    state.flags.nameWritten ? 'La última línea tiene nombre.' : '',
  ].filter(Boolean);

  return {
    heading: 'Libreta azul',
    summary: immediateSummary(state),
    hand: state.flags.notebookFound
      ? 'Hallazgos breves. El archivo largo queda abajo.'
      : 'Todavía falta encontrarla.',
    lines: state.notebook,
    cards: visibleCards,
    connections,
    mutations,
    sections,
  };
}

function immediateSummary(state: GameState) {
  if (!state.flags.envelopeRead) return 'Entré por cuaderno y carpeta.';
  if (!state.flags.notebookFound) return 'Falta el cuaderno azul.';
  if (!state.flags.servicePlanSeen) return 'El servicio es la ruta.';
  if (!state.flags.behaviorProfileSeen) return 'El punto rojo mide algo.';
  if (!state.flags.truthUnderstood) return 'Plano y cuaderno deben cruzarse.';
  if (!state.flags.valuationReady) return 'La venta depende del relato.';
  return 'Elegí qué versión sale de la casa.';
}
