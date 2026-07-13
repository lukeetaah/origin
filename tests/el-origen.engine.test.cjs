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
  state = applyAction(state, 'readNotebook');
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

test('fresh entry starts from a cover state and gives the player an immediate concrete goal', () => {
  const state = freshGame();
  assert.equal(state.started, false);
  assert.equal(state.scene, 'door');
  assert.match(state.notice, /tasaci[oó]n/);

  const entered = applyAction(state, 'enter');
  assert.equal(entered.started, true);
  assert.match(entered.notice, /casa/);
  assert.match(entered.notice, /versi[oó]n/);
});

test('apartment door opens immediately and moves to the hallway without arbitrary key gates', () => {
  let state = start();
  const door = findHotspot(state, 'apartment-door');
  assert.ok(door);
  assert.equal(canUseHotspot(state, door).ok, true);
  state = applyAction(state, door.action);
  assert.equal(state.scene, 'hallway');
  assert.equal(state.flags.doorOpened, true);
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

test('domestic rooms use coherent scenes, assets and hotspots', () => {
  let state = start();
  state = applyAction(state, 'openApartmentDoor');

  const kitchen = applyAction(state, 'travelKitchen');
  assert.equal(kitchen.scene, 'kitchen');
  assert.match(sceneRegistry.kitchen.aria, /Cocina/);
  assert.equal(sceneRegistry.kitchen.background.src, '/bg-kitchen.png');
  assert.ok(findHotspot(kitchen, 'fridge-check'));
  assert.ok(findHotspot(kitchen, 'kitchen-folder'));

  const bedroom = applyAction(state, 'travelBedroom');
  assert.equal(bedroom.scene, 'bedroom');
  assert.match(sceneRegistry.bedroom.aria, /Dormitorio de la abuela/);
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

test('the notebook appears through a physical kitchen gesture and evolves with evidence', () => {
  const state = reachNotebook();
  assert.equal(state.carrying, 'notebook');
  assert.equal(state.flags.notebookFound, true);
  assert.equal(state.flags.ledgerDecoded, true);

  const notebook = buildNotebook(state);
  assert.match(notebook.heading, /Libreta azul/);
  assert.ok(notebook.lines.some((line) => /Protocolo/.test(line.text)));
  assert.ok(notebook.mutations.some((line) => /administraci[oó]n de desgaste/.test(line)));
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

test('three main endings are reachable through physical choices rather than menu labels', () => {
  const ceded = applyAction(reachValuation(), 'acceptLowPrice');
  assert.equal(ceded.scene, 'ending');
  assert.equal(ceded.ending, 'ceder');
  assert.match(ceded.notice, /tasaci[oó]n baja/);

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
});

test('visible EL ORIGEN content is not contaminated by retired identities, brands or borrowed IP', () => {
  const banned = /(RUPTURA|Nora|Elda|casillero|Mutual|La Espera|Juli[aá]n|Malena|Sosa|SIAM|Di Tella|Mario|Bros|Estanciero|Puccio|Maradona|FIFA|ORIGIN)/i;
  const truth = reachValuation();
  const surface = [
    ...Object.values(sceneRegistry).flatMap((scene) => [
      scene.aria,
      ...scene.ambient,
      ...scene.hotspots.flatMap((hotspot) => [hotspot.label, hotspot.verb, hotspot.id]),
    ]),
    ...buildNotebook(truth).lines.map((line) => line.text),
    ...buildNotebook(truth).sections.flatMap((section) => [section.title, ...section.lines]),
    truth.notice,
  ].join('\n');

  assert.doesNotMatch(surface, banned);
});
