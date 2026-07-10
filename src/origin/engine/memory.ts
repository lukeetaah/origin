import { Hypothesis, Scene, SessionState } from './types';
const empty = (): SessionState => ({ behavior: { startedAt: Date.now(), clicks: 0, holds: 0, returns: 0, revisits: 0, hidden: 0, sceneVisits: { hallway: 0, living: 0, kitchen: 0, bedroom: 0 }, objectVisits: {}, lastActionAt: Date.now() }, readings: [], dramaticState: 'threshold' });
export class SessionEngine {
  private state = empty();
  constructor() { try { if (sessionStorage.getItem('origin-session-v2')) this.state.behavior.returns = 1; } catch {} }
  act(id: string, kind: 'click' | 'hold', scene: Scene) { const b = this.state.behavior; const elapsed = Date.now() - b.lastActionAt; b[kind === 'click' ? 'clicks' : 'holds']++; b.sceneVisits[scene]++; b.objectVisits[id] = (b.objectVisits[id] || 0) + 1; if (b.objectVisits[id] > 1) { b.revisits++; this.add('returning', .8, 'volvió a un elemento'); } if (elapsed < 900) this.add('urgent', .7, 'acciones consecutivas'); if (kind === 'hold') this.add('careful', .85, 'mantuvo la atención'); b.lastActionAt = Date.now(); this.save(); }
  visit(scene: Scene) { this.state.behavior.sceneVisits[scene]++; this.save(); }
  hide() { this.state.behavior.hidden++; this.add('resistant', .55, 'interrumpió la sesión'); this.save(); }
  setDramaticState(dramaticState: SessionState['dramaticState']) { this.state.dramaticState = dramaticState; this.save(); }
  get() { return this.state; } has(id: string) { return Boolean(this.state.behavior.objectVisits[id]); } count(id: string) { return this.state.behavior.objectVisits[id] || 0; }
  dominant(): Hypothesis { const scores = new Map<Hypothesis, number>(); this.state.readings.forEach(r => scores.set(r.hypothesis, (scores.get(r.hypothesis) || 0) + r.confidence)); return [...scores.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] || 'exploring'; }
  private add(hypothesis: Hypothesis, confidence: number, evidence: string) { this.state.readings.push({ hypothesis, confidence, evidence }); }
  private save() { try { sessionStorage.setItem('origin-session-v2', JSON.stringify(this.state)); } catch {} }
}
