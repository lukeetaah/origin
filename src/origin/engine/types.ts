// ─── Room Objects ───────────────────────────────────────────────

export type RoomObjectId = 'door' | 'table' | 'photograph' | 'letter' | 'wall' | 'wallSound' | 'light';

export interface RoomObject {
  id: RoomObjectId;
  label: string;
  visible: boolean;
  intensity: number;       // 0-1, how "present" the object feels
  altered: boolean;        // has the director changed it?
  narrativeWeight: number; // 0-1, accumulated attention
}

// ─── Interaction ────────────────────────────────────────────────

export type InteractionType =
  | 'hover_start'
  | 'hover_end'
  | 'click'
  | 'stillness'
  | 'movement'
  | 'tab_leave'
  | 'tab_return'
  | 'session_start'
  | 'session_return';

export type UserBehavior =
  | 'stillness'
  | 'restless'
  | 'focused'
  | 'returning'
  | 'absent'
  | 'lingering';

export interface InteractionEvent {
  type: InteractionType;
  target?: RoomObjectId;
  timestamp: number;
  duration?: number;        // for hover_end, stillness
  position?: { x: number; y: number };
}

// ─── Narrative ──────────────────────────────────────────────────

export type NarrativePhase =
  | 'arrival'
  | 'attention'
  | 'distortion'
  | 'perspectiveShift'
  | 'exit';

export type PerspectiveMode =
  | 'observer'
  | 'photograph'
  | 'wallSound';

export type EndingType = 'photograph' | 'letter' | 'door';

export interface NarrativeFragment {
  id: string;
  text: string;
  phase: NarrativePhase;
  perspective?: PerspectiveMode;
  trigger?: RoomObjectId;
  condition?: 'focused' | 'ignored' | 'any';
  ending?: EndingType;
  weight: number;           // priority weight for selection
}

// ─── Memory ─────────────────────────────────────────────────────

export interface ObjectAttention {
  totalTime: number;        // ms
  hoverCount: number;
  clickCount: number;
  lastInteraction: number;  // timestamp
}

export interface MemoryState {
  sessionCount: number;
  currentSessionStart: number;
  objectAttention: Record<RoomObjectId, ObjectAttention>;
  dominantObject: RoomObjectId | null;
  lastPerspective: PerspectiveMode;
  currentPhase: NarrativePhase;
  shownFragments: string[];
  tabLeaves: number;
  endingReached: EndingType | null;
  userBehavior: UserBehavior;
  totalInteractions: number;
  lastStillnessAt: number;
  sessionDuration: number;
}

// ─── Director ───────────────────────────────────────────────────

export interface StagingPlan {
  perspective: PerspectiveMode;
  phase: NarrativePhase;
  fragmentToShow: NarrativeFragment | null;
  objectStates: Partial<Record<RoomObjectId, Partial<RoomObject>>>;
  ambientShift: {
    lightColor: string;
    lightIntensity: number;   // 0-1
    droneFrequency: number;   // Hz
    droneVolume: number;      // 0-1
    roomStability: number;    // 0-1, affects visual distortion
  };
  silenceDuration: number;    // ms of pause before next fragment
  shouldEnd: boolean;
  ending?: EndingType;
}

export interface DirectorState {
  lastPlan: StagingPlan | null;
  planCount: number;
  phaseStartTime: number;
  phaseTransitions: number;
  perspectiveChanges: number;
}
