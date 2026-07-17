import { GameState } from './types';

export function observeVisibility(state: GameState, hidden: boolean): GameState {
  if (!hidden) return state;
  const eventId = `tab-return-${state.scene}`;
  const alreadySeen = state.director.tensionEvents?.includes(eventId);
  return {
    ...state,
    notice: alreadySeen ? state.notice : 'Mientras mirabas otra pestaña, alguien cerró la carpeta que dejaste abierta.',
    director: {
      ...state.director,
      hiddenWhileActive: state.director.hiddenWhileActive + 1,
      cues: alreadySeen ? state.director.cues : [...state.director.cues, 'La casa aprovechó el momento en que dejaste de mirarla.'].slice(-5),
      tensionEvents: alreadySeen ? state.director.tensionEvents : [...(state.director.tensionEvents ?? []), eventId],
    },
  };
}
