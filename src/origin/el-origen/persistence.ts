import { applyAction, createMemory, freshGame, recoverFromCorruptSave } from './game';
import { CarryItem, GameState, OLD_SAVE_KEYS, OriginMemory, SAVE_KEY, SAVE_VERSION, SceneId, StoredGame } from './types';

const scenes = new Set<SceneId>(['door', 'hallway', 'living', 'kitchen', 'bedroom', 'service', 'hidden', 'ending']);

export function clearCurrentSaveForDevelopment() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_KEY);
}

export function isolateOldSaves() {
  if (typeof window === 'undefined') return;
  for (const key of OLD_SAVE_KEYS) {
    if (window.localStorage.getItem(key)) window.localStorage.removeItem(key);
  }
}

export function hasValidStoredGame() {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    return Boolean(normalizeStored(JSON.parse(raw)));
  } catch {
    return false;
  }
}

export function loadStoredGame() {
  if (typeof window === 'undefined') return freshGame();
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return freshGame();

  try {
    const stored = normalizeStored(JSON.parse(raw));
    if (!stored) return recoverFromCorruptSave();
    return stored.state;
  } catch {
    return recoverFromCorruptSave();
  }
}

export function saveStoredGame(state: ReturnType<typeof freshGame>) {
  if (typeof window === 'undefined') return state;
  const stored: StoredGame = { version: SAVE_VERSION, state };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
  return state;
}

function normalizeStored(value: unknown): StoredGame | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<StoredGame>;
  if (maybe.version !== SAVE_VERSION || !maybe.state || typeof maybe.state !== 'object') return null;
  const state = maybe.state;
  if (!scenes.has(state.scene)) return null;

  const memory = normalizeMemory(state.memory);
  const carrying: CarryItem = state.carrying === 'notebook' ? 'notebook' : null;
  const safe: GameState = {
    ...freshGame(memory),
    ...state,
    version: SAVE_VERSION,
    scene: state.scene,
    memory,
    flags: typeof state.flags === 'object' && state.flags ? state.flags : {},
    facts: Array.isArray(state.facts) ? state.facts : [],
    notebook: Array.isArray(state.notebook) ? state.notebook : [],
    actions: Array.isArray(state.actions) ? state.actions : [],
    route: Array.isArray(state.route) ? state.route.filter((scene) => scenes.has(scene)) : ['door'],
    carrying,
    ending: state.ending ?? null,
    notice: typeof state.notice === 'string' ? state.notice : '¿Dónde está el cuaderno azul de Nora?',
    started: Boolean(state.started),
  };

  if (safe.scene === 'ending' && !safe.ending) return null;
  if (safe.scene !== 'ending' && safe.ending) return { version: SAVE_VERSION, state: applyAction(safe, 'startAgain') };
  return { version: SAVE_VERSION, state: safe };
}

function normalizeMemory(value: unknown): OriginMemory {
  if (!value || typeof value !== 'object') return createMemory();
  const memory = value as Partial<OriginMemory>;
  return createMemory({
    entries: typeof memory.entries === 'number' && Number.isFinite(memory.entries) ? memory.entries : 0,
    endings: Array.isArray(memory.endings) ? memory.endings.filter((ending): ending is OriginMemory['endings'][number] => (
      ending === 'administrativa' || ending === 'familiar' || ending === 'comunitaria' || ending === 'cuidadora'
    )) : [],
    returnedNotebook: Boolean(memory.returnedNotebook),
    deliveredNotebook: Boolean(memory.deliveredNotebook),
    hiddenNotebook: Boolean(memory.hiddenNotebook),
    repeatedRoutes: memory.repeatedRoutes && typeof memory.repeatedRoutes === 'object' ? memory.repeatedRoutes : {},
    contradictions: Array.isArray(memory.contradictions) ? memory.contradictions.filter((item): item is string => typeof item === 'string') : [],
    corruptSavesRecovered: typeof memory.corruptSavesRecovered === 'number' && Number.isFinite(memory.corruptSavesRecovered)
      ? memory.corruptSavesRecovered
      : 0,
    lastNotebookLine: typeof memory.lastNotebookLine === 'string' ? memory.lastNotebookLine : undefined,
  });
}
