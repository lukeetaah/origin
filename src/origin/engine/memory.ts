import { ActionKind, Hypothesis, Scene, SessionState } from './types';

const empty = (): SessionState => ({
  behavior: {
    startedAt: Date.now(),
    taps: 0,
    holds: 0,
    drags: 0,
    returns: 0,
    revisits: 0,
    hidden: 0,
    sceneVisits: { hallway: 0, living: 0, kitchen: 0, bedroom: 0 },
    objectVisits: {},
    lastActionAt: Date.now(),
  },
  readings: [],
  dramaticState: 'threshold',
});

export class SessionEngine {
  private state = empty();

  constructor() {
    try {
      if (sessionStorage.getItem('origin-session-v3')) this.state.behavior.returns = 1;
    } catch {}
  }

  act(id: string, kind: ActionKind, _scene: Scene) {
    void _scene;
    const behavior = this.state.behavior;
    const elapsed = Date.now() - behavior.lastActionAt;
    if (kind === 'tap') behavior.taps++;
    if (kind === 'hold') behavior.holds++;
    if (kind === 'drag') behavior.drags++;
    behavior.objectVisits[id] = (behavior.objectVisits[id] || 0) + 1;
    if (behavior.objectVisits[id] > 1) {
      behavior.revisits++;
      this.add('returning', 0.7, `volvió a ${id}`);
    }
    if (elapsed < 800) this.add('quick', 0.45, 'acciones seguidas');
    if (kind === 'hold') this.add('careful', 0.8, `sostuvo ${id}`);
    if (kind === 'drag') this.add('listening', 0.75, `manipuló ${id}`);
    if (behavior.objectVisits[id] > 2) this.add('insistent', 0.65, `insistió sobre ${id}`);
    behavior.lastActionAt = Date.now();
    this.save();
  }

  visit(scene: Scene) {
    const behavior = this.state.behavior;
    behavior.sceneVisits[scene]++;
    if (scene === 'hallway' && behavior.sceneVisits.hallway > 1) this.add('returning', 0.5, 'volvió al pasillo');
    this.save();
  }

  hide() {
    this.state.behavior.hidden++;
    this.add('resistant', 0.4, 'interrumpió la sesión');
    this.save();
  }

  setDramaticState(dramaticState: SessionState['dramaticState']) {
    this.state.dramaticState = dramaticState;
    this.save();
  }

  get() { return this.state; }
  has(id: string) { return Boolean(this.state.behavior.objectVisits[id]); }
  count(id: string) { return this.state.behavior.objectVisits[id] || 0; }

  dominant(): Hypothesis {
    const scores = new Map<Hypothesis, number>();
    this.state.readings.forEach(reading => scores.set(reading.hypothesis, (scores.get(reading.hypothesis) || 0) + reading.confidence));
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'exploring';
  }

  private add(hypothesis: Hypothesis, confidence: number, evidence: string) {
    this.state.readings.push({ hypothesis, confidence, evidence });
  }

  private save() {
    try {
      sessionStorage.setItem('origin-session-v3', JSON.stringify(this.state));
    } catch {}
  }
}
