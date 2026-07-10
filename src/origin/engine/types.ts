export type Scene = 'hallway' | 'living' | 'kitchen' | 'bedroom';
export type DramaticState = 'threshold' | 'attention' | 'recognition' | 'confrontation' | 'decision' | 'consequence';
export type Hypothesis = 'exploring' | 'careful' | 'urgent' | 'insistent' | 'resistant' | 'returning';
export interface ObservedBehavior { startedAt: number; clicks: number; holds: number; returns: number; revisits: number; hidden: number; sceneVisits: Record<Scene, number>; objectVisits: Record<string, number>; lastActionAt: number; }
export interface Reading { hypothesis: Hypothesis; confidence: number; evidence: string; }
export interface SessionState { behavior: ObservedBehavior; readings: Reading[]; dramaticState: DramaticState; }
