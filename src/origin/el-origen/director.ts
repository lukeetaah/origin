import { GameState } from './types';

export function observeVisibility(state: GameState, hidden: boolean): GameState {
  if (!hidden) return state;
  const eventId = `tab-return-${state.scene}`;
  const alreadySeen = state.director.tensionEvents?.includes(eventId);
  return {
    ...state,
    notice: alreadySeen ? state.notice : 'Un objeto cambió mientras no mirabas.',
    director: {
      ...state.director,
      hiddenWhileActive: state.director.hiddenWhileActive + 1,
      cues: alreadySeen ? state.director.cues : [...state.director.cues, 'La casa cambió cuando no mirabas.'].slice(-5),
      tensionEvents: alreadySeen ? state.director.tensionEvents : [...(state.director.tensionEvents ?? []), eventId],
    },
  };
}
