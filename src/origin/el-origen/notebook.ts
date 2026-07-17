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
    state.flags.keyringSeen ? { id: 'key', kicker: 'llaves', text: 'Separaron la azul para Tomás.', question: '¿Qué abrió durante la primera visita?' } : null,
    state.flags.notebookFound ? { id: 'notebook', kicker: 'cuaderno', text: 'Sus iniciales corrigen el protocolo.', question: '¿Cuántas instrucciones llegó a cumplir?' } : null,
    state.flags.fridgeChecked ? { id: 'fridge', kicker: 'heladera', text: 'El abandono fue armado después.', question: '¿Por qué Tomás figura en la lista?' } : null,
    state.flags.planOverlayDone ? { id: 'overlay', kicker: 'plano', text: 'Cada recorrido termina en T.F.', question: '¿Está investigando o repitiendo?' } : null,
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
    state.flags.ledgerDecoded ? '“Cuidado” fue tachado. Abajo: “desgaste”. La corrección es de T.F.' : '',
    state.flags.objectMovedAfterInspection ? 'La foto cambió al quedar fuera de luz. Ahora Tomás aparece detrás de la cámara.' : '',
    state.flags.behaviorProfileSeen ? 'Nueva columna: demora / duda / obediencia. Los tiempos coinciden.' : '',
    state.flags.planOverlayDone ? 'Plano + libreta: cada engaño termina en T.F.' : '',
    state.flags.valuationReady ? 'La carpeta ya había marcado firma y rechazo.' : '',
    state.memory.endings.length > 0 ? 'La casa conservó la elección anterior. También conservó el tiempo que tomó.' : '',
    state.flags.nameWritten ? 'La última línea completa la primera firma.' : '',
  ].filter(Boolean);

  return {
    heading: 'Libreta azul',
    summary: immediateSummary(state),
    hand: state.flags.notebookFound
      ? 'Las páginas no acusan a la familia: registran a Tomás.'
      : 'Mamá pidió encontrarla sin leerla.',
    lines: state.notebook,
    cards: visibleCards,
    connections,
    mutations,
    sections,
  };
}

function immediateSummary(state: GameState) {
  if (!state.flags.envelopeRead) return 'Mamá pidió retirar pruebas, no recuerdos.';
  if (!state.flags.notebookFound) return 'La casa siguió encendida para esta visita.';
  if (!state.flags.servicePlanSeen) return 'El cuaderno tiene correcciones de T.F.';
  if (!state.flags.behaviorProfileSeen) return 'El pasillo borrado termina en sus iniciales.';
  if (!state.flags.truthUnderstood) return 'El punto rojo recuerda una visita idéntica.';
  if (!state.flags.valuationReady) return 'Tomás no investiga el protocolo: lo repite.';
  return 'Hasta la negativa ya estaba escrita.';
}
