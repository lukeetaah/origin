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
  freshGame,
  recoverFromCorruptSave,
  visibleHotspots,
} = require('../.tmp/el-origen-tests/game.js');
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
  assert.equal(state.started, false);
  assert.equal(state.scene, 'door');
  assert.match(state.notice, /llave azul/);

  const entered = applyAction(state, 'enter');
  assert.equal(entered.started, true);
  assert.match(entered.notice, /llave azul/);
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

test('behavioral profile and hidden panel are gated by material evidence', () => {
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
  assert.match(ceded.notice, /tasación baja/);

  const resisted = applyAction(reachValuation(), 'refusePrice');
  assert.equal(resisted.ending, 'resistir');
  assert.match(resisted.notice, /Rechaz/);

  let exposed = reachValuation();
  exposed = applyAction(exposed, 'travelHidden');
  exposed = applyAction(exposed, 'exposeProtocol');
  assert.equal(exposed.ending, 'exponer');
  assert.match(exposed.notice, /archivo completo/);
});

test('a fourth anomalous possibility appears only after the house remembers a prior ending', () => {
  const first = applyAction(reachValuation(), 'acceptLowPrice');
  assert.equal(first.memory.endings.length, 1);

  const second = reachTruth(first.memory);
  assert.equal(findHotspot(second, 'write-name')?.action, 'writeNameAndHangNotebook');
  const fourth = applyAction(second, 'writeNameAndHangNotebook');
  assert.equal(fourth.ending, 'despertar');
  assert.match(fourth.notice, /tablero vivo/);
});

test('corrupt saves recover into a clean entry instead of mixing old state', () => {
  const recovered = recoverFromCorruptSave(createMemory({ corruptSavesRecovered: 2 }));
  assert.equal(recovered.started, false);
  assert.equal(recovered.scene, 'door');
  assert.equal(recovered.memory.corruptSavesRecovered, 3);
  assert.match(recovered.notice, /entrada limpia/);
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
