/* eslint-disable @typescript-eslint/no-require-imports */
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
  state = applyAction(state, 'inspectPot');
  state = applyAction(state, 'loosenTile');
  state = applyAction(state, 'takeNotebook');
  return state;
}

function reachTruth(memory) {
  let state = freshGame(memory);
  state = applyAction(state, 'enter');
  state = applyAction(state, 'openApartmentDoor');
  state = applyAction(state, 'travelKitchen');
  state = applyAction(state, 'inspectPot');
  state = applyAction(state, 'loosenTile');
  state = applyAction(state, 'takeNotebook');
  state = applyAction(state, 'travelService');
  state = applyAction(state, 'inspectServicePlan');
  state = applyAction(state, 'overlayLedgerAndPlan');
  state = applyAction(state, 'openHiddenPanel');
  state = applyAction(state, 'travelHidden');
  return state;
}

test('fresh entry starts from a cover state and gives the player an immediate concrete goal', () => {
  const state = freshGame();
  assert.equal(state.started, false);
  assert.equal(state.scene, 'door');
  assert.match(state.notice, /cuaderno azul de Nora/);

  const entered = applyAction(state, 'enter');
  assert.equal(entered.started, true);
  assert.match(entered.notice, /Encontrá el cuaderno azul/);
  assert.match(entered.notice, /consorcio/);
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

test('kitchen and bedroom use coherent scenes, assets and hotspots', () => {
  let state = start();
  state = applyAction(state, 'openApartmentDoor');

  const kitchen = applyAction(state, 'travelKitchen');
  assert.equal(kitchen.scene, 'kitchen');
  assert.match(sceneRegistry.kitchen.aria, /Cocina/);
  assert.equal(sceneRegistry.kitchen.background.src, '/bg-kitchen.png');
  assert.ok(findHotspot(kitchen, 'big-pot'));

  const bedroom = applyAction(state, 'travelBedroom');
  assert.equal(bedroom.scene, 'bedroom');
  assert.match(sceneRegistry.bedroom.aria, /Dormitorio de Nora/);
  assert.equal(sceneRegistry.bedroom.background.src, '/bg-bedroom.png');
  assert.ok(findHotspot(bedroom, 'height-marks'));
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
  assert.match(notebook.heading, /Cuaderno azul/);
  assert.ok(notebook.lines.some((line) => /Fondo de mesa/.test(line.text)));
  assert.ok(notebook.mutations.some((line) => /origen/.test(line)));
});

test('final placements are hidden until the material truth is understood', () => {
  let state = reachNotebook();
  state = applyAction(state, 'travelKitchen');
  assert.equal(findHotspot(state, 'admin-envelope-final'), undefined);

  state = applyAction(state, 'travelService');
  state = applyAction(state, 'inspectServicePlan');
  state = applyAction(state, 'overlayLedgerAndPlan');
  state = applyAction(state, 'travelKitchen');
  assert.ok(findHotspot(state, 'admin-envelope-final'));
});

test('three physical endings are reachable without explicit menu labels', () => {
  const admin = applyAction(reachTruth(), 'placeNotebookAdminEnvelope');
  assert.equal(admin.scene, 'ending');
  assert.equal(admin.ending, 'administrativa');
  assert.match(admin.notice, /sobre/);

  const family = applyAction(reachTruth(), 'placeNotebookFamilyBox');
  assert.equal(family.ending, 'familiar');
  assert.match(family.notice, /caja familiar/);

  const community = applyAction(reachTruth(), 'returnNotebookAndOpenDoor');
  assert.equal(community.ending, 'comunitaria');
  assert.match(community.notice, /puerta queda/);
});

test('a fourth possibility appears only after the house remembers a prior ending', () => {
  const first = applyAction(reachTruth(), 'returnNotebookAndOpenDoor');
  assert.equal(first.memory.endings.length, 1);

  const second = applyAction(reachTruth(first.memory), 'travelKitchen');
  assert.equal(findHotspot(second, 'hang-notebook')?.action, 'writeNameAndHangNotebook');
  const fourth = applyAction(second, 'writeNameAndHangNotebook');
  assert.equal(fourth.ending, 'cuidadora');
  assert.match(fourth.notice, /relevo/);
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

test('visible EL ORIGEN content is not contaminated by retired project identity', () => {
  const banned = /(RUPTURA|casillero|Mutual|La Espera|Juli[aá]n|Malena|Sosa|El que faltaba|ORIGIN|Elda)/i;
  const surface = [
    ...Object.values(sceneRegistry).flatMap((scene) => [
      scene.aria,
      ...scene.ambient,
      ...scene.hotspots.flatMap((hotspot) => [hotspot.label, hotspot.verb, hotspot.id]),
    ]),
    ...buildNotebook(reachTruth()).lines.map((line) => line.text),
    reachTruth().notice,
  ].join('\n');

  assert.doesNotMatch(surface, banned);
});
