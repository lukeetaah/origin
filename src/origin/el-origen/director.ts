import { GameState } from './types';

export function observeVisibility(state: GameState, hidden: boolean): GameState {
  if (!hidden) return state;
  return {
    ...state,
    director: {
      ...state.director,
      hiddenWhileActive: state.director.hiddenWhileActive + 1,
      cues: [...state.director.cues, 'Al volver de otra pestaña, la casa deja de sonar medio segundo antes que vos.'].slice(-5),
    },
  };
}
