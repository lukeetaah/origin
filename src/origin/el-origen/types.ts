export const SAVE_VERSION = 2 as const;
export const SAVE_KEY = 'el-origen-casa-de-nora-v2';
export const OLD_SAVE_KEYS = [] as const;

export type SceneId = 'door' | 'hallway' | 'living' | 'kitchen' | 'bedroom' | 'service' | 'hidden' | 'ending';

export type EndingId = 'administrativa' | 'familiar' | 'comunitaria' | 'cuidadora';

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
  | 'heightMarksRead'
  | 'keyringSeen'
  | 'servicePlanSeen'
  | 'planOverlayDone'
  | 'hiddenPanelOpened'
  | 'registryUnderstood'
  | 'truthUnderstood'
  | 'doorLeftOpen'
  | 'nameWritten';

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
  | 'inspectHeightMarks'
  | 'inspectKeyring'
  | 'inspectServicePlan'
  | 'overlayLedgerAndPlan'
  | 'openHiddenPanel'
  | 'placeNotebookAdminEnvelope'
  | 'placeNotebookFamilyBox'
  | 'returnNotebookAndOpenDoor'
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

export type Hotspot = {
  id: string;
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

export type FactKind = 'encargo' | 'contradiccion' | 'registro' | 'cuidado' | 'objeto' | 'consecuencia';

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
