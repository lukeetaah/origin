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

  const cards = [
    state.flags.keyringSeen ? { id: 'key', kicker: 'llaves', text: 'La azul no está.' } : null,
    state.flags.folderFound ? { id: 'folder', kicker: 'fechas', text: 'Primero desgaste. Después precio.' } : null,
    state.flags.fridgeChecked ? { id: 'fridge', kicker: 'heladera', text: 'No era abandono.' } : null,
    state.flags.notebookFound ? { id: 'notebook', kicker: 'libreta', text: 'La casa se abarataba en la cabeza.' } : null,
    state.flags.servicePlanSeen ? { id: 'plan', kicker: 'plano', text: 'El pasillo no figura.' } : null,
    state.flags.behaviorProfileSeen ? { id: 'sensor', kicker: 'etiqueta', text: 'También me miden.' } : null,
    state.flags.valuationReady ? { id: 'price', kicker: 'precio', text: 'La cifra baja con mi cansancio.' } : null,
  ].filter((card): card is { id: string; kicker: string; text: string } => Boolean(card));

  const mutations = [
    state.flags.ledgerDecoded ? '“Cuidado” → “desgaste”.' : '',
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
      ? 'Recordatorio rápido. El archivo largo queda abajo.'
      : 'Todavía falta encontrarla.',
    lines: state.notebook,
    cards,
    mutations,
    sections,
  };
}

function immediateSummary(state: GameState) {
  if (!state.flags.notebookFound) return 'Falta la libreta azul.';
  if (!state.flags.keyringSeen) return 'Falta revisar las llaves.';
  if (!state.flags.servicePlanSeen) return 'El pasillo pide un plano.';
  if (!state.flags.behaviorProfileSeen) return 'El punto rojo imprime algo.';
  if (!state.flags.truthUnderstood) return 'Superponé libreta y plano.';
  if (!state.flags.valuationReady) return 'Volvé al living.';
  return 'La cifra espera una decisión.';
}
