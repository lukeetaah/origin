/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  abandonHeldAction,
  applyAction,
  canUseHotspot,
  createMemory,
  discoverInspectionClue,
  freshGame,
  recoverFromCorruptSave,
  triggerFlashlightEvent,
  visibleHotspots,
} = require('../.tmp/el-origen-tests/game.js');
const { inspectionObjects, allInspectionClues } = require('../.tmp/el-origen-tests/inspection.js');
const { buildNotebook } = require('../.tmp/el-origen-tests/notebook.js');
const { objectRegistry } = require('../.tmp/el-origen-tests/objects.js');
const { sceneRegistry } = require('../.tmp/el-origen-tests/scenes.js');

function start() {
  let state = freshGame();
  state = applyAction(state, 'enter');
  return state;
}

function findHotspot(state, id) {
  return visibleHotspots(state).find((hotspot) => hotspot.id === id);
}

function reachNotebook() {
  let state = start();
  state = applyAction(state, 'openApartmentDoor');
  state = applyAction(state, 'travelKitchen');
  state = applyAction(state, 'inspectFolder');
  state = applyAction(state, 'checkFridge');
  state = applyAction(state, 'loosenTile');
  state = applyAction(state, 'takeNotebook');
  return state;
}

function reachTruth(memory) {
  let state = freshGame(memory);
  state = applyAction(state, 'enter');
  state = applyAction(state, 'openApartmentDoor');
  state = applyAction(state, 'travelKitchen');
  state = applyAction(state, 'inspectFolder');
  state = applyAction(state, 'checkFridge');
  state = applyAction(state, 'loosenTile');
  state = applyAction(state, 'takeNotebook');
  state = applyAction(state, 'travelService');
  state = applyAction(state, 'inspectServicePlan');
  state = applyAction(state, 'inspectBehaviorProfile');
  state = applyAction(state, 'overlayLedgerAndPlan');
  state = applyAction(state, 'openHiddenPanel');
  state = applyAction(state, 'travelHidden');
  return state;
}

function reachValuation(memory) {
  let state = reachTruth(memory);
  state = applyAction(state, 'travelLiving');
  state = applyAction(state, 'watchTV1986');
  state = applyAction(state, 'inspectValuation');
  return state;
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${filePath} is a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function overlapRatio(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (overlap === 0) return 0;
  return overlap / Math.min(a.w * a.h, b.w * b.h);
}

function assertNoClickStealing(state, label) {
  const hotspots = visibleHotspots(state);
  for (let a = 0; a < hotspots.length; a += 1) {
    for (let b = a + 1; b < hotspots.length; b += 1) {
      const ratio = overlapRatio(hotspots[a].rect, hotspots[b].rect);
      assert.ok(ratio < 0.35, `${label}: ${hotspots[a].id} steals clicks from ${hotspots[b].id} (${ratio.toFixed(2)})`);
    }
  }
}

test('fresh entry gives one immediate concrete goal', () => {
  const state = freshGame();
  state.startedAt = 1;
  assert.equal(state.started, false);
  assert.equal(state.scene, 'door');
  assert.match(state.notice, /cuaderno azul/i);
  assert.match(state.notice, /carpeta/);
  assert.match(state.notice, /20:00/);

  const entered = applyAction(state, 'enter');
  assert.equal(entered.started, true);
  assert.ok(entered.startedAt > 1, 'the deadline starts at the first real entry, not on the cover');
  assert.match(entered.notice, /cuaderno azul/i);
  assert.match(entered.notice, /carpeta/);

  const resumed = applyAction(entered, 'continue');
  assert.equal(resumed.startedAt, entered.startedAt, 'continuing preserves elapsed play time');
  assert.equal(resumed.memory.entries, entered.memory.entries, 'continuing does not count as another run');
});

test('apartment door opens immediately and moves to the hallway without arbitrary key gates', () => {
  let state = start();
  const door = findHotspot(state, 'apartment-door');
  assert.ok(door);
  assert.equal(canUseHotspot(state, door).ok, true);
  state = applyAction(state, door.action);
  assert.equal(state.scene, 'hallway');
  assert.equal(state.flags.doorOpened, true);
  assert.equal(state.flags.envelopeRead, true);
});

test('all playable rooms use real coherent image assets with matching declared dimensions', () => {
  for (const [id, scene] of Object.entries(sceneRegistry)) {
    assert.equal(scene.background.kind, 'image', `${id} should not use procedural placeholders`);
    const filePath = path.join(process.cwd(), 'public', scene.background.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(filePath), `${id} asset exists`);
    const size = pngSize(filePath);
    assert.deepEqual(size, {
      width: scene.background.width,
      height: scene.background.height,
    }, `${id} dimensions match declaration`);
    assert.equal(size.width / size.height, 1.5, `${id} uses the 3:2 stage ratio`);
  }
});

test('every hotspot is backed by a registered visible object on the same asset', () => {
  const seenHotspotIds = new Set();

  for (const [sceneId, scene] of Object.entries(sceneRegistry)) {
    const ids = new Set();
    for (const hotspot of scene.hotspots) {
      assert.ok(!ids.has(hotspot.id), `${sceneId} duplicate hotspot ${hotspot.id}`);
      ids.add(hotspot.id);
      seenHotspotIds.add(hotspot.id);
      assert.ok(hotspot.objectId, `${hotspot.id} has objectId`);
      const object = objectRegistry[hotspot.objectId];
      assert.ok(object, `${hotspot.id} references registered object ${hotspot.objectId}`);
      assert.equal(object.scene, sceneId, `${hotspot.id} object scene`);
      assert.equal(object.asset, scene.background.src, `${hotspot.id} object asset`);
      assert.equal(object.hotspotId, hotspot.id, `${hotspot.id} object hotspotId`);
      assert.deepEqual(object.rect, hotspot.rect, `${hotspot.id} rect matches object registry`);
      assert.ok(hotspot.rect.w >= object.minSize.w && hotspot.rect.h >= object.minSize.h, `${hotspot.id} respects min size`);
      assert.ok(hotspot.rect.w <= object.maxSize.w && hotspot.rect.h <= object.maxSize.h, `${hotspot.id} respects max size`);
    }
  }

  for (const object of Object.values(objectRegistry)) {
    assert.ok(seenHotspotIds.has(object.hotspotId), `${object.id} registered object has hotspot`);
    assert.ok(object.visualDescription.length > 12, `${object.id} has visual description`);
    assert.ok(object.hover.length > 1, `${object.id} has hover feedback`);
    assert.ok(object.touch.length > 1, `${object.id} has touch feedback`);
  }
});

test('inspection system gives every physical object one explicit interaction pattern', () => {
  const inspectables = Object.values(inspectionObjects);
  assert.ok(inspectables.length >= 6, 'at least six inspectable objects');
  assert.ok(inspectables.filter((object) => object.primary).length >= 4, 'at least four primary objects');
  assert.ok(inspectables.filter((object) => object.pattern === 'open').length >= 2, 'at least two openable objects');

  const clueList = allInspectionClues();
  assert.equal(clueList.some((clue) => clue.requiresLight), false, 'no clue is blocked behind inspection flashlight aiming');

  for (const object of inspectables) {
    assert.ok(['observe', 'open', 'reveal'].includes(object.pattern), `${object.id} has one supported pattern`);
    assert.equal(object.clues.length, 1, `${object.id} exposes one focused clue`);
    assert.ok(object.instruction.split(/\s+/).length <= 8, `${object.id} instruction is short`);
    assert.ok(object.initialObservation.split(/\s+/).length <= 18, `${object.id} first observation is short`);
    assert.ok(object.afterClueObservation.split(/\s+/).length <= 18, `${object.id} clue observation is short`);
    for (const clue of object.clues) {
      assert.ok(clue.fact.split(/\s+/).length <= 18, `${object.id}/${clue.id} fact is short`);
      assert.equal(Boolean(clue.requiresOpen), object.pattern === 'open', `${object.id}/${clue.id} opening gate matches its pattern`);
    }
  }
});

test('scene hotspots keep flashlight metadata without blocking narrative objects', () => {
  const inspectableIds = new Set(Object.keys(inspectionObjects));
  for (const scene of Object.values(sceneRegistry)) {
    for (const hotspot of scene.hotspots) {
      if (!hotspot.inspectable) continue;
      assert.ok(inspectableIds.has(hotspot.inspectable), `${hotspot.id} references inspectable object`);
      assert.equal(hotspot.requiresLight, true, `${hotspot.id} keeps cinematic flashlight metadata`);
      assert.ok(typeof hotspot.lightRadius === 'number' && hotspot.lightRadius >= 28, `${hotspot.id} has forgiving light radius`);
    }
  }
});

test('domestic rooms use coherent scenes, assets and hotspots', () => {
  let state = start();
  state = applyAction(state, 'openApartmentDoor');

  const kitchen = applyAction(state, 'travelKitchen');
  assert.equal(kitchen.scene, 'kitchen');
  assert.equal(sceneRegistry.kitchen.background.src, '/bg-kitchen.png');
  assert.ok(findHotspot(kitchen, 'fridge-check'));
  assert.ok(findHotspot(kitchen, 'kitchen-folder'));

  const bedroom = applyAction(state, 'travelBedroom');
  assert.equal(bedroom.scene, 'bedroom');
  assert.equal(sceneRegistry.bedroom.background.src, '/bg-bedroom.png');
  assert.ok(findHotspot(bedroom, 'grandmother-keyring'));

  const service = applyAction(state, 'travelService');
  assert.equal(service.scene, 'service');
  assert.equal(sceneRegistry.service.background.src, '/bg-service.png');
  assert.ok(findHotspot(service, 'service-plan'));

  const hidden = reachTruth();
  assert.equal(hidden.scene, 'hidden');
  assert.equal(sceneRegistry.hidden.background.src, '/bg-hidden.png');
  assert.ok(findHotspot(hidden, 'wall-registry'));
});

test('all hotspot coordinates stay inside the playable plane', () => {
  for (const scene of Object.values(sceneRegistry)) {
    for (const hotspot of scene.hotspots) {
      assert.ok(hotspot.rect.x >= 0 && hotspot.rect.x <= 100, `${hotspot.id} x`);
      assert.ok(hotspot.rect.y >= 0 && hotspot.rect.y <= 100, `${hotspot.id} y`);
      assert.ok(hotspot.rect.w > 2 && hotspot.rect.w <= 45, `${hotspot.id} w`);
      assert.ok(hotspot.rect.h > 2 && hotspot.rect.h <= 80, `${hotspot.id} h`);
      assert.ok(hotspot.rect.x + hotspot.rect.w <= 101, `${hotspot.id} right edge`);
      assert.ok(hotspot.rect.y + hotspot.rect.h <= 101, `${hotspot.id} bottom edge`);
    }
  }
});

test('simultaneous visible hotspots do not steal each other clicks', () => {
  let state = start();
  assertNoClickStealing(state, 'door');

  state = applyAction(state, 'openApartmentDoor');
  assertNoClickStealing(state, 'hallway');

  state = applyAction(state, 'travelKitchen');
  assertNoClickStealing(state, 'kitchen-empty');
  state = applyAction(state, 'inspectFolder');
  state = applyAction(state, 'checkFridge');
  state = applyAction(state, 'loosenTile');
  assertNoClickStealing(state, 'kitchen-tile');
  state = applyAction(state, 'takeNotebook');
  assertNoClickStealing(state, 'kitchen-notebook');

  state = applyAction(state, 'travelService');
  state = applyAction(state, 'inspectServicePlan');
  assertNoClickStealing(state, 'service-plan');
  state = applyAction(state, 'inspectBehaviorProfile');
  state = applyAction(state, 'overlayLedgerAndPlan');
  assertNoClickStealing(state, 'service-panel');
  state = applyAction(state, 'openHiddenPanel');
  assertNoClickStealing(state, 'service-open');

  state = applyAction(state, 'travelHidden');
  assertNoClickStealing(state, 'hidden');
});

test('the notebook is a quick reminder plus optional archive, not required reading', () => {
  const state = reachNotebook();
  assert.equal(state.carrying, 'notebook');
  assert.equal(state.flags.notebookFound, true);
  assert.equal(state.flags.ledgerDecoded, true);

  const notebook = buildNotebook(state);
  assert.match(notebook.heading, /Libreta azul/);
  assert.ok(notebook.summary.length <= 42, 'summary stays short');
  assert.ok(notebook.cards.some((card) => card.id === 'notebook'));
  assert.ok(notebook.mutations.some((line) => /desgaste/.test(line)));
  assert.ok(notebook.sections.every((section) => Array.isArray(section.lines)), 'archive sections are optional');
});

test('inspection clues, not first clicks, create evidence and progress', () => {
  let state = start();
  state = discoverInspectionClue(state, 'administrator-envelope', 'utility-after-admission');
  assert.equal(state.flags.envelopeRead, true);
  assert.ok(state.evidence.some((item) => item.clueId === 'utility-after-admission'));
  assert.match(state.notice, /luz|internarla/i);

  state = applyAction(state, 'openApartmentDoor');
  state = applyAction(state, 'travelKitchen');
  state = discoverInspectionClue(state, 'kitchen-folder', 'sale-before-admission');
  assert.equal(state.flags.folderFound, true);
  assert.ok(state.evidence.some((item) => item.objectId === 'kitchen-folder'));

  state = applyAction(state, 'checkFridge');
  state = applyAction(state, 'loosenTile');
  state = discoverInspectionClue(state, 'blue-notebook', 'pressure-script');
  assert.equal(state.flags.notebookFound, true);
  assert.equal(state.carrying, 'notebook');

  const notebook = buildNotebook(state);
  assert.ok(notebook.cards.length <= 5);
  assert.ok(notebook.connections.length <= 5);
  assert.ok(notebook.cards.some((card) => /familia|oferta/i.test(card.text)));
});

test('flashlight focus can change the house without awarding unrelated facts', () => {
  let state = reachNotebook();
  const beforeFacts = state.facts.length;
  const beforeNotice = state.notice;
  const inert = triggerFlashlightEvent(state, 'administrator-envelope');
  assert.equal(inert.notice, beforeNotice);
  assert.equal(inert.director.flashlightEvents.length, state.director.flashlightEvents.length);

  state = triggerFlashlightEvent(state, 'family-photo');
  assert.equal(state.flags.objectMovedAfterInspection, true);
  assert.equal(state.objectStates['family-photo'].changed, true);
  assert.equal(state.facts.length, beforeFacts);

  state = triggerFlashlightEvent(state, 'family-photo');
  const repeated = state.director.flashlightEvents.filter((event) => event === 'light-family-photo');
  assert.equal(repeated.length, 1);
});

test('the strong startle is earned by flashlight focus on the opened route and only fires once', () => {
  let state = reachTruth();
  assert.equal(state.flags.strongStartleUsed, undefined);
  state = triggerFlashlightEvent(state, 'hidden-panel');
  assert.equal(state.flags.strongStartleUsed, true);
  assert.equal(state.director.strongStartleUsed, true);
  assert.match(state.notice, /panel golpea/);

  const notice = state.notice;
  state = triggerFlashlightEvent(state, 'hidden-panel');
  assert.equal(state.notice, notice);
  assert.equal(state.director.flashlightEvents.filter((event) => event === 'light-hidden-panel').length, 1);
});

test('behavioral profile and hidden panel are gated by material evidence', () => {
  let early = start();
  early = applyAction(early, 'openApartmentDoor');
  early = applyAction(early, 'travelService');
  early = applyAction(early, 'inspectServicePlan');
  assert.equal(findHotspot(early, 'behavior-sensor'), undefined, 'red dot waits until the notebook makes surveillance legible');

  let state = reachNotebook();
  state = applyAction(state, 'travelService');
  assert.equal(findHotspot(state, 'hidden-panel'), undefined);

  state = applyAction(state, 'inspectServicePlan');
  assert.ok(findHotspot(state, 'behavior-sensor'));
  state = applyAction(state, 'inspectBehaviorProfile');
  state = applyAction(state, 'overlayLedgerAndPlan');
  assert.ok(findHotspot(state, 'hidden-panel'));
});

test('valuation choices stay hidden until the player understands the protocol and behavior tracking', () => {
  let state = reachNotebook();
  state = applyAction(state, 'travelLiving');
  assert.equal(findHotspot(state, 'valuation-folder'), undefined);

  state = reachTruth();
  state = applyAction(state, 'travelLiving');
  assert.ok(findHotspot(state, 'valuation-folder'));
  state = applyAction(state, 'inspectValuation');
  assert.equal(state.flags.valuationReady, true);
  assert.ok(findHotspot(state, 'accept-low-price'));
  assert.ok(findHotspot(state, 'refuse-low-price'));
});

test('essential progression does not require opening the optional notebook archive', () => {
  const state = reachValuation();
  assert.equal(state.flags.truthUnderstood, true);
  assert.equal(state.flags.valuationReady, true);
  assert.equal(state.actions.filter((action) => action === 'readNotebook').length, 0);
});

test('adaptive tension events have cooldowns and never repeat the same route cue', () => {
  let state = start();
  state = applyAction(state, 'openApartmentDoor');
  state = applyAction(state, 'travelKitchen');
  state = applyAction(state, 'travelHallway');
  state = applyAction(state, 'travelKitchen');
  assert.ok(state.director.tensionEvents.includes('route-hallway->kitchen'));

  state = applyAction(state, 'travelHallway');
  state = applyAction(state, 'travelKitchen');
  const repeatedEvents = state.director.tensionEvents.filter((event) => event === 'route-hallway->kitchen');
  assert.equal(repeatedEvents.length, 1);
});

test('three main endings are reachable through physical choices rather than menu labels', () => {
  const ceded = applyAction(reachValuation(), 'acceptLowPrice');
  assert.equal(ceded.scene, 'ending');
  assert.equal(ceded.ending, 'ceder');
  assert.match(ceded.notice, /formulario/);

  const resisted = applyAction(reachValuation(), 'refusePrice');
  assert.equal(resisted.ending, 'resistir');
  assert.match(resisted.notice, /Tachás/);

  let exposed = reachValuation();
  exposed = applyAction(exposed, 'travelHidden');
  exposed = applyAction(exposed, 'exposeProtocol');
  assert.equal(exposed.ending, 'exponer');
  assert.match(exposed.notice, /Copiás el archivo/);
});

test('a fourth anomalous possibility appears only after the house remembers a prior ending', () => {
  const first = applyAction(reachValuation(), 'acceptLowPrice');
  assert.equal(first.memory.endings.length, 1);

  const second = reachTruth(first.memory);
  assert.equal(findHotspot(second, 'write-name')?.action, 'writeNameAndHangNotebook');
  const fourth = applyAction(second, 'writeNameAndHangNotebook');
  assert.equal(fourth.ending, 'despertar');
  assert.match(fourth.notice, /letra anterior/);
});

test('corrupt saves recover into a clean entry instead of mixing old state', () => {
  const recovered = recoverFromCorruptSave(createMemory({ corruptSavesRecovered: 2 }));
  assert.equal(recovered.started, false);
  assert.equal(recovered.scene, 'door');
  assert.equal(recovered.memory.corruptSavesRecovered, 3);
  assert.match(recovered.notice, /partida anterior/);
});

test('abandoned sustained interactions are tracked but do not rewrite truth', () => {
  const before = reachNotebook();
  const after = abandonHeldAction(before);
  assert.equal(after.director.heldActionsAbandoned, before.director.heldActionsAbandoned + 1);
  assert.deepEqual(after.facts, before.facts);
  assert.equal(after.flags.truthUnderstood, before.flags.truthUnderstood);
  assert.ok(after.director.tensionEvents.includes('abandon-kitchen'));
});

test('visible EL ORIGEN content is not contaminated by retired identities, brands or borrowed IP', () => {
  const banned = /(RUPTURA|Nora|Elda|casillero|Mutual|La Espera|Juli[aá]n|Malena|Sosa|SIAM|Di Tella|Mario|Bros|Estanciero|Puccio|Maradona|FIFA|ORIGIN)/i;
  const truth = reachValuation();
  const notebook = buildNotebook(truth);
  const surface = [
    ...Object.values(sceneRegistry).flatMap((scene) => [
      scene.aria,
      ...scene.ambient,
      ...scene.hotspots.flatMap((hotspot) => [hotspot.label, hotspot.verb, hotspot.id, hotspot.objectId]),
    ]),
    ...Object.values(objectRegistry).flatMap((object) => [object.internalName, object.visualDescription, object.hover, object.touch]),
    ...notebook.lines.map((line) => line.text),
    ...notebook.sections.flatMap((section) => [section.title, ...section.lines]),
    truth.notice,
  ].join('\n');

  assert.doesNotMatch(surface, banned);
});

test('object descriptions are concrete and not accidentally duplicated', () => {
  const bannedGeneric = /(parece haber sido sacada acá|hay algo extraño|esto podría ser importante|me resulta familiar|no recuerdo esto|la casa parece distinta)/i;
  const descriptions = [
    ...Object.values(objectRegistry).map((object) => object.visualDescription),
    ...Object.values(inspectionObjects).flatMap((object) => [
      object.initialObservation,
      object.afterClueObservation,
      object.changedObservation ?? '',
      ...object.clues.map((clue) => clue.fact),
    ]),
  ].filter(Boolean);

  const normalized = descriptions.map((text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
  assert.equal(new Set(normalized).size, normalized.length, 'no identical object descriptions');
  for (const text of descriptions) {
    assert.doesNotMatch(text, bannedGeneric);
    assert.ok(text.split(/\s+/).length <= 35, `mandatory object text too long: ${text}`);
  }
});

test('inspection interface stays 2D, readable and free of broken WebGL dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const viewer = fs.readFileSync(path.join(process.cwd(), 'src/origin/components/InspectionViewer.tsx'), 'utf8');
  const sceneView = fs.readFileSync(path.join(process.cwd(), 'src/origin/components/SceneView.tsx'), 'utf8');
  const experience = fs.readFileSync(path.join(process.cwd(), 'src/origin/components/Experience.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(process.cwd(), 'src/origin/styles/elOrigen.module.css'), 'utf8');
  const dependencies = Object.keys(pkg.dependencies ?? {});

  assert.ok(!dependencies.some((name) => name === 'three' || name.startsWith('@react-three/')), 'no three.js runtime dependency');
  assert.doesNotMatch(viewer, /Canvas|WebGL|webgl|react-three|three/i);
  assert.doesNotMatch(styles, /perspective\(|rotateX|rotateY|inspectionCanvas/);
  assert.match(viewer, /EnvelopeState = 'closed' \| 'opening' \| 'open'/, 'the envelope uses an explicit three-state machine');
  assert.match(viewer, /window\.setTimeout\(\(\) => \{\s+setPhase\('open'\)/, 'opening completes through a timeout fallback');
  assert.match(viewer, /data-envelope-state/, 'envelope state is exposed for deterministic QA');
  assert.match(viewer, /object\.pattern === 'open'/, 'opening is one explicit pattern');
  assert.match(viewer, /object\.pattern === 'observe'/, 'observation is one explicit pattern');
  assert.match(viewer, /object\.pattern === 'reveal'/, 'press-to-reveal is one explicit pattern');
  assert.match(viewer, /event\.target === event\.currentTarget/, 'clicking outside closes inspection safely');
  assert.match(viewer, /event\.key === 'Escape'/, 'Escape closes inspection safely');
  assert.match(viewer, /envelopeArtifact/, 'the envelope has a dedicated stable composition');
  assert.match(viewer, /photoArtifactSimple/, 'photos have a dedicated readable body');
  assert.match(viewer, /keyArtifactSimple/, 'keys have a dedicated physical body');
  assert.match(viewer, /sensorArtifactSimple/, 'sensors have a dedicated physical body');
  assert.match(experience, /prologueCopy/, 'the game opens with a brief family call');
  assert.match(experience, /La abuela sigue internada/, 'the prologue states the family version concretely');
  assert.match(experience, /deadlineFor/, 'the HUD exposes a visible countdown instead of hiding the deadline in prose');
  assert.match(experience, /ghostPhaseFor/, 'subtle hauntings are directed by scene state');
  assert.match(sceneView, /initialFocusFor/, 'scene flashlight starts on the first narrative object');
  assert.match(sceneView, /preload\.onerror = \(\) => setBackgroundFailed\(true\)/, 'missing scene images switch to a controlled fallback');
  assert.match(sceneView, /data-asset-fallback/, 'asset fallback state is exposed for QA');
  assert.match(sceneView, /flashlightHandle/, 'the flashlight is visible as a simple in-scene prop');
  assert.match(sceneView, /const interactiveLit = lit \|\| Boolean\(hotspot\.inspectable\)/, 'inspectable hotspots remain interactive even outside the flashlight cone');
  assert.match(experience, /key=\{state\.scene\}/, 'scene changes reset the initial cinematic focus');
  assert.match(styles, /\.envelopeArtifact/, 'the envelope has a stable paper composition');
  assert.match(styles, /\.paperArtifactSimple/, 'documents remain contained and readable');
  assert.match(styles, /\.revealPoint/, 'point reveals use one visible target');
  assert.match(styles, /\.coverParticles/, 'the prologue uses cheap procedural atmosphere instead of heavy assets');
  assert.match(styles, /\.deadlineHud/, 'the deadline has an explicit Mafia-like HUD timer');
  assert.match(styles, /\.ghostLayer/, 'horror beats can appear and disappear without heavy assets');
  assert.match(styles, /\.flashlightHandle/, 'the flashlight is represented visually without WebGL');
  assert.match(styles, /\.inspectionClose/, 'close control stays visible and keyboard focusable');
  assert.match(styles, /object-fit:\s*contain|aspect-ratio/, 'object proportions remain bounded');
});

test('Vercel remains a Next app build and does not target static out', () => {
  const nextConfig = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
  assert.doesNotMatch(nextConfig, /output:\s*['"]export['"]/);
  assert.equal(vercel.framework, 'nextjs');
  assert.equal(vercel.outputDirectory, '.next');
  assert.equal(vercel.rewrites, undefined, 'Vercel must let Next route its own assets and runtime files');
});
