// Screenshot staging behind ?shot=title|play|chase|caught|escaped.
// Each scene plays the real rules forward from a fresh world with a fixed seed,
// steered by a simple autopilot (jump what can be jumped, slide under the knife,
// change lane around the oven, chase the nearest corn), so every frame is what
// a real game looks like and the same seed always gives the same frame.
import { GameState } from './main.js';

const SAMPLE = 1 / 30;

/** The nearest hazard ahead in the turkey's lane, or null. */
function hazardAhead(game) {
  let best = null;
  for (const ob of game.obstacles) {
    const dz = -ob.position.z; // positive = ahead of the turkey
    if (dz < -1 || dz > 16) continue;
    if (Math.abs(ob.position.x - game.turkeyX) > 1.15) continue;
    if (best === null || dz < best.dz) best = { kind: ob.userData.kind, dz, jumpable: ob.userData.jumpable, slideable: ob.userData.slideable };
  }
  return best;
}

/** The lane of the nearest corn ahead, or null. */
function cornLane(game) {
  let best = null;
  for (const p of game.pickups) {
    const dz = -p.position.z;
    if (dz < 0 || dz > 22) continue;
    if (best === null || dz < best.dz) best = { lane: p.position.x, dz };
  }
  return best === null ? null : best.lane;
}

/** The nearest hazard distance ahead in the lane at `laneX` (Infinity if none). */
function dangerAt(game, laneX, ahead, tallOnly) {
  let best = Infinity;
  for (const ob of game.obstacles) {
    const dz = -ob.position.z;
    if (dz < -1 || dz > ahead) continue;
    if (Math.abs(ob.position.x - laneX) > 1.15) continue;
    if (tallOnly && (ob.userData.jumpable || ob.userData.slideable)) continue;
    if (dz < best) best = dz;
  }
  return best;
}

function autopilot(game) {
  const actions = [];
  const hazard = hazardAhead(game);
  if (hazard) {
    if (!hazard.jumpable && !hazard.slideable) {
      // An oven: move to the lane whose nearest tall hazard is farthest away,
      // preferring one with no close hazard of any kind.
      let bestLane = null;
      let bestScore = -1;
      for (const lane of [-2.3, 0, 2.3]) {
        if (Math.abs(lane - game.turkeyX) < 0.1) continue;
        const tall = dangerAt(game, lane, 24, true);
        const any = dangerAt(game, lane, 10, false);
        const score = tall + (any === Infinity ? 6 : 0);
        if (score > bestScore) { bestScore = score; bestLane = lane; }
      }
      if (bestLane !== null) actions.push(bestLane < game.turkeyX ? 'left' : 'right');
    } else if (hazard.slideable && hazard.dz < 6.5) {
      actions.push('slide');
    } else if (hazard.jumpable && hazard.dz < game.speed * 0.45 + 1.2 && game.grounded) {
      actions.push('jump');
    }
  } else {
    // No immediate hazard: drift toward the nearest corn, but only into a
    // lane with no tall hazard close ahead.
    const corn = cornLane(game);
    if (corn !== null && Math.abs(corn - game.turkeyX) > 0.1) {
      if (dangerAt(game, corn, 14, true) === Infinity) {
        actions.push(corn < game.turkeyX ? 'left' : 'right');
      }
    }
  }
  return actions;
}

/** No-op pilot: never moves — the turkey gets caught, as a frozen player would. */
function frozenPilot() {
  return [];
}

/** Run the game forward `seconds` with the given pilot. */
function simulate(game, seconds, pilot) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (game.state !== GameState.PLAYING) break;
    game.step(SAMPLE, pilot(game));
  }
}

/**
 * Set `game` to the named scene and return the screen it shows.
 * Called once at load when the URL carries ?shot=.
 */
export function stageShot(name, game, seed) {
  game.reset(seed);
  if (name === 'title') {
    game.state = GameState.TITLE;
    game.gap = 9;
    game.spawnDecor();
    // Slide the turkey out from behind the title card so it peeks into frame.
    game.turkey.group.position.x = 5.5;
    game.showTitle();
    idle(game, 2);
    return 'title';
  }
  game.hideOverlay();
  game.showHud();
  game.state = GameState.PLAYING;
  if (name === 'chase') {
    simulate(game, 40, autopilot);
    game.gap = 3.2;
    simulate(game, 1, autopilot);
    return 'play';
  }
  if (name === 'caught') {
    simulate(game, 600, frozenPilot);
    idle(game, 2);
    return 'caught';
  }
  if (name === 'escaped') {
    // Start 100 m short so the run earns its corn before the finish line.
    game.distance = 900;
    simulate(game, 30, autopilot);
    // Slide the celebrating turkey out from behind the end card.
    game.turkey.group.position.x = 5.0;
    idle(game, 2);
    return 'escaped';
  }
  // Default: a mid-run action shot.
  simulate(game, 24, autopilot);
  simulate(game, 1, autopilot);
  return 'play';
}

/** Let toasts fade and end animations settle before the screenshot. */
function idle(game, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) game.step(SAMPLE, []);
}
