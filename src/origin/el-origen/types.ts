export const SAVE_VERSION = 4 as const;
export const SAVE_KEY = 'el-origen-la-casa-v4';
export const OLD_SAVE_KEYS = ['el-origen-la-casa-v3', 'el-origen-casa-de-nora-v2'] as const;

export type SceneId = 'door' | 'hallway' | 'living' | 'kitchen' | 'bedroom' | 'service' | 'hidden' | 'ending';

export type EndingId = 'ceder' | 'resistir' | 'exponer' | 'despertar';

export type CarryItem = 'notebook' | null;

export type FlagId =
  | 'entered'
  | 'envelopeRead'
  | 'doorOpened'
  | 'photoMismatch'
  | 'radioTuned'
  | 'potRemembered'
  | 'tileLoose'
  | 'notebookFound'
  | 'ledgerDecoded'
  | 'folderFound'
  | 'fridgeChecked'
  | 'keyringSeen'
  | 'tv1986Seen'
  | 'servicePlanSeen'
  | 'behaviorProfileSeen'
  | 'planOverlayDone'
  | 'hiddenPanelOpened'
  | 'registryUnderstood'
  | 'truthUnderstood'
  | 'valuationReady'
  | 'lowPriceMarked'
  | 'priceRefused'
  | 'protocolExposed'
  | 'nameWritten'
  | 'serviceDoorPhotoSeen'
  | 'familyMessageContradicted'
  | 'objectMovedAfterInspection'
  | 'houseRepeatedAction'
  | 'strongStartleUsed';

export type ActionId =
  | 'enter'
  | 'continue'
  | 'readEnvelope'
  | 'openApartmentDoor'
  | 'travelHallway'
  | 'travelLiving'
  | 'travelKitchen'
  | 'travelBedroom'
  | 'travelService'
  | 'travelHidden'
  | 'inspectPhoto'
  | 'tuneRadio'
  | 'inspectPot'
  | 'loosenTile'
  | 'takeNotebook'
  | 'readNotebook'
  | 'inspectFolder'
  | 'checkFridge'
  | 'inspectKeyring'
  | 'watchTV1986'
  | 'inspectServicePlan'
  | 'inspectBehaviorProfile'
  | 'overlayLedgerAndPlan'
  | 'openHiddenPanel'
  | 'inspectValuation'
  | 'acceptLowPrice'
  | 'refusePrice'
  | 'exposeProtocol'
  | 'writeNameAndHangNotebook'
  | 'wait'
  | 'startAgain';

export type SoundCue = 'paper' | 'door' | 'wood' | 'ceramic' | 'radio' | 'intercom' | 'pot' | 'pencil' | 'silence';

export type Requirement =
  | { kind: 'flag'; flag: FlagId }
  | { kind: 'notFlag'; flag: FlagId }
  | { kind: 'carry'; item: CarryItem }
  | { kind: 'memoryEndings'; count: number };

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HotspotShape = 'rect' | 'circle' | 'door' | 'paper' | 'object';
export type InteractiveObjectId = string;
export type InspectableObjectId = string;
export type InspectionClueId = string;
export type InspectionSide = 'front' | 'back' | 'left' | 'right' | 'top' | 'base' | 'inside';
export type InspectionModelKind = 'photo' | 'document' | 'folder' | 'keys' | 'notebook' | 'cassette' | 'box' | 'sensor' | 'pot';

export type Hotspot = {
  id: string;
  objectId: InteractiveObjectId;
  label: string;
  verb: string;
  rect: Rect;
  action: ActionId;
  exitTo?: SceneId;
  layer?: 'far' | 'mid' | 'near';
  sound?: SoundCue;
  holdMs?: number;
  gesture?: 'hold' | 'drag' | 'place';
  visibleWhen?: Requirement[];
  requirements?: Requirement[];
  requiresLight?: boolean;
  lightRadius?: number;
  inspectable?: InspectableObjectId;
};

export type SceneRecord = {
  id: Exclude<SceneId, 'ending'>;
  background:
    | { kind: 'image'; src: string; width: number; height: number }
    | { kind: 'procedural'; style: 'door'; width: number; height: number };
  aria: string;
  ambient: string[];
  hotspots: Hotspot[];
};

export type InteractiveObjectRecord = {
  id: InteractiveObjectId;
  hotspotId: string;
  scene: Exclude<SceneId, 'ending'>;
  internalName: string;
  narrativeState: 'visible' | 'revealed' | 'state-dependent' | 'exit';
  visualDescription: string;
  asset: string;
  rect: Rect;
  shape: HotspotShape;
  minSize: Rect;
  maxSize: Rect;
  action: ActionId;
  hover: string;
  touch: string;
  alternateState?: string;
  dependencies?: Requirement[];
  sound?: SoundCue;
  notebookEntry?: string;
  inspection?: InspectableObjectId;
  required: boolean;
};

export type ObjectNarrativeState = {
  objectId: InteractiveObjectId;
  first: string;
  clueFound: string;
  afterRelated: string;
  changed: string;
};

export type InspectionClue = {
  id: InspectionClueId;
  side: InspectionSide;
  title: string;
  fact: string;
  question: string;
  reveal: string;
  requiresLight?: boolean;
  lightZone?: 'left' | 'center' | 'right' | 'top' | 'bottom';
  requiresOpen?: boolean;
  consequence: ActionId;
};

export type InspectableObject = {
  id: InspectableObjectId;
  objectId: InteractiveObjectId;
  title: string;
  scene: Exclude<SceneId, 'ending'>;
  model: InspectionModelKind;
  primary: boolean;
  canOpen?: boolean;
  canDisassemble?: boolean;
  material: 'paper' | 'cardboard' | 'metal' | 'cloth' | 'glass' | 'ceramic' | 'plastic' | 'wood';
  instruction: string;
  initialObservation: string;
  afterClueObservation: string;
  changedObservation?: string;
  clues: InspectionClue[];
};

export type NarrativeEvidence = {
  id: string;
  objectId: InteractiveObjectId;
  clueId: InspectionClueId;
  icon: string;
  title: string;
  fact: string;
  link?: string;
  question: string;
  at: number;
};

export type InspectedObjectState = {
  inspected: boolean;
  open: boolean;
  changed: boolean;
  discoveredClues: InspectionClueId[];
};

export type FactKind = 'tramite' | 'familia' | 'protocolo' | 'conducta' | 'tasacion' | 'anomalia' | 'consecuencia';

export type Fact = {
  id: string;
  kind: FactKind;
  text: string;
  scene: SceneId;
  at: number;
};

export type NotebookLine = {
  id: string;
  text: string;
  struck?: boolean;
};

export type OriginMemory = {
  version: typeof SAVE_VERSION;
  entries: number;
  endings: EndingId[];
  returnedNotebook: boolean;
  deliveredNotebook: boolean;
  hiddenNotebook: boolean;
  repeatedRoutes: Record<string, number>;
  contradictions: string[];
  corruptSavesRecovered: number;
  lastNotebookLine?: string;
};

export type DirectorState = {
  sceneVisits: Record<string, number>;
  routeCounts: Record<string, number>;
  ignoredItems: string[];
  heldActionsAbandoned: number;
  cues: string[];
  hiddenWhileActive: number;
  tensionEvents: string[];
  lastTensionAction: number;
  flashlightEvents: string[];
  lastLitObject?: string;
  strongStartleUsed: boolean;
};

export type GameState = {
  version: typeof SAVE_VERSION;
  runId: string;
  started: boolean;
  scene: SceneId;
  previousScene?: SceneId;
  carrying: CarryItem;
  flags: Partial<Record<FlagId, boolean>>;
  facts: Fact[];
  evidence: NarrativeEvidence[];
  objectStates: Record<string, InspectedObjectState>;
  notebook: NotebookLine[];
  notice: string;
  ending: EndingId | null;
  actions: ActionId[];
  route: SceneId[];
  director: DirectorState;
  memory: OriginMemory;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
};

export type StoredGame = {
  version: typeof SAVE_VERSION;
  state: GameState;
};
