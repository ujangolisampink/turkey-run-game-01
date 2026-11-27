// Gobble Run — the Great Thanksgiving Escape.
// A 3D endless runner: a turkey sprints down a farm lane, dodging hay bales,
// fences, pumpkins, a hot oven and a swinging carving knife, grabbing corn
// while the farmer gains on it from behind. Reach 1000 m and you are free;
// lose all 3 lives, or let the farmer catch you, and you are dinner.
// States: title -> playing <-> paused -> caught | escaped. Restart resets all.
import {
  LANES, ESCAPE_DISTANCE, START_LIVES, START_GAP, GAP_DRAIN_PER_SEC,
  GAP_PER_CORN, GAP_PER_HIT, BASE_SPEED, MAX_SPEED, SPAWN_AHEAD,
  DESPAWN_BEHIND, GRAVITY, JUMP_SPEED, CORN_SCORE, BERRY_SCORE,
  INVULN_SECONDS,
} from './config.js';
import { makeRandom } from './random.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { World, loadTextures } from './world.js';
import { buildTurkey, buildFarmer, buildObstacle, buildCorn, buildBerry } from './entities.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;

export const GameState = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CAUGHT: 'caught',
  ESCAPED: 'escaped',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GameState.TITLE;
    this.seed = 1;
    this.rng = makeRandom(this.seed);
    this.score = 0;
    this.distance = 0;
    this.lives = START_LIVES;
    this.gap = START_GAP;
    this.speed = BASE_SPEED;
    this.time = 0;
    this.laneIndex = 1;
    this.turkeyX = 0;
    this.turkeyY = 0;
    this.vy = 0;
    this.grounded = true;
    this.sliding = false;
    this.slideTimer = 0;
    this.invulnTimer = 0;
    this.obstacles = [];
    this.pickups = [];
    this.nextSpawnAt = 30;
    this.shake = 0;
    this.toastTimer = 0;
    this.cornCollected = 0;
    this.berriesCollected = 0;
    this.hits = 0;
    this.runPhase = 0;
    this.shotMode = false;
    this.framesRendered = 0;

    // DOM.
    this.hud = document.getElementById('hud');
    this.scoreEl = document.getElementById('score');
    this.distEl = document.getElementById('dist');
    this.livesEl = document.getElementById('lives');
    this.farmerFill = document.getElementById('farmerFill');
    this.farmerLabel = document.getElementById('farmerLabel');
    this.toastEl = document.getElementById('toast');
    this.overlay = document.getElementById('overlay');
    this.cardTitle = document.getElementById('cardTitle');
    this.cardSub = document.getElementById('cardSub');
    this.cardText = document.getElementById('cardText');
    this.startBtn = document.getElementById('startBtn');
    this.againBtn = document.getElementById('againBtn');
    this.muteBtn = document.getElementById('muteBtn');
    this.statusEl = document.getElementById('status');

    this.input = new Input(canvas);
    this.sfx = new Sfx();
    this.input.onAnyGesture = () => this.sfx.ensure();
    this.input.onPause = (paused) => {
      if (paused && this.state === GameState.PLAYING) this.pause();
      else if (!paused && this.state === GameState.PAUSED) this.resume();
    };
    this.input.onMute = (muted) => {
      this.sfx.setMuted(muted);
      this.muteBtn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
    };
    this.startBtn.addEventListener('click', () => {
      this.sfx.ensure();
      this.sfx.click();
      if (this.state === GameState.PAUSED) this.resume();
      else this.startGame();
    });
    this.againBtn.addEventListener('click', () => {
      this.sfx.ensure();
      this.sfx.click();
      this.startGame();
    });
    this.muteBtn.addEventListener('click', () => {
      this.sfx.ensure();
      const muted = !this.sfx.muted;
      this.sfx.setMuted(muted);
      this.muteBtn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === GameState.PLAYING) this.pause();
    });
    window.addEventListener('resize', () => this.onResize());
    // For the headless playtest bot.
    window.__press = (action) => this.input.queue.push(action);
    window.__game = this;
  }

  async init() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 4.8, 9.8);

    const hemi = new THREE.HemisphereLight(0xfff2cc, 0x8a6b46, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe3b3, 1.15);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    this.scene.add(sun);

    const textures = await loadTextures();
    this.world = new World(this.scene, textures, this.rng);
    this.turkey = buildTurkey();
    this.scene.add(this.turkey.group);
    this.farmer = buildFarmer();
    this.scene.add(this.farmer.group);

    this.reset(1);
    this.showTitle();

    // Screenshot staging (?shot=title|play|chase|caught|escaped&seed=N).
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = true;
      const seed = Number(params.get('seed') || 7);
      stageShot(shot, this, seed);
    }

    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (this.state !== GameState.PAUSED) this.step(dt, this.input.takeActions());
      this.render();
      this.framesRendered += 1;
      if (this.shotMode && this.framesRendered >= 3) window.__shotReady = true;
      if (this.framesRendered === 3) window.__ready = true;
    };
    loop();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  reset(seed) {
    this.seed = seed;
    this.rng = makeRandom(seed);
    for (const ob of this.obstacles) this.scene.remove(ob);
    for (const p of this.pickups) this.scene.remove(p);
    this.obstacles = [];
    this.pickups = [];
    this.score = 0;
    this.distance = 0;
    this.lives = START_LIVES;
    this.gap = START_GAP;
    this.speed = BASE_SPEED;
    this.time = 0;
    this.laneIndex = 1;
    this.turkeyX = 0;
    this.turkeyY = 0;
    this.vy = 0;
    this.grounded = true;
    this.sliding = false;
    this.slideTimer = 0;
    this.invulnTimer = 0;
    this.nextSpawnAt = 30;
    this.shake = 0;
    this.cornCollected = 0;
    this.berriesCollected = 0;
    this.hits = 0;
    this.turkey.group.position.set(0, 0, 0);
    this.turkey.group.visible = true;
    this.updateHud();
  }

  startGame() {
    this.reset((Math.random() * 1e9) | 0);
    this.state = GameState.PLAYING;
    this.hideOverlay();
    this.showHud();
    this.sfx.gobble();
    this.setStatus('The escape is on. Run!');
    this.showToast('RUN! The farmer is coming!');
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    this.cardTitle.textContent = 'PAUSED';
    this.cardSub.textContent = 'Take a breath, turkey';
    this.cardText.textContent = 'The farmer waits for no bird. Press P or tap Resume to keep running.';
    this.startBtn.textContent = 'RESUME';
    this.startBtn.classList.remove('hidden');
    this.againBtn.classList.add('hidden');
    this.overlay.classList.remove('hidden');
    this.setStatus('Game paused.');
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.hideOverlay();
    this.sfx.click();
    this.setStatus('The escape is on. Run!');
  }

  endGame(caught) {
    this.state = caught ? GameState.CAUGHT : GameState.ESCAPED;
    this.turkey.group.visible = true; // stop any invulnerability blink
    this.turkey.group.scale.y = 1;
    if (caught) {
      this.sfx.lose();
      this.sfx.farmerYell();
      this.cardTitle.textContent = 'CAUGHT!';
      this.cardSub.textContent = 'Thanksgiving dinner is served...';
      this.cardText.textContent = `The farmer got you after ${Math.floor(this.distance)} m. `
        + `Score ${this.score} — ${this.cornCollected} corn grabbed. The oven was already hot. Try again, faster and sneakier.`;
      this.setStatus(`Caught after ${Math.floor(this.distance)} metres. Score ${this.score}.`);
    } else {
      this.sfx.win();
      this.cardTitle.textContent = 'ESCAPED!';
      this.cardSub.textContent = 'Free at last — the forest is yours';
      this.cardText.textContent = `You ran the full ${ESCAPE_DISTANCE} m and outran the farmer! `
        + `Score ${this.score} — ${this.cornCollected} corn and ${this.berriesCollected} cranberries grabbed. `
        + `No turkey dinner this Thanksgiving.`;
      this.setStatus(`Escaped! Score ${this.score}.`);
    }
    this.startBtn.classList.add('hidden');
    this.againBtn.classList.remove('hidden');
    this.overlay.classList.remove('hidden');
    this.updateHud();
  }

  showTitle() {
    this.state = GameState.TITLE;
    this.cardTitle.textContent = 'GOBBLE RUN';
    this.cardSub.textContent = 'The Great Thanksgiving Escape';
    this.cardText.textContent = 'You are the turkey. Thanksgiving is coming, the farmer is right behind you, '
      + 'and the farm is full of ovens, carving knives, hay bales and fences. Run 1000 metres '
      + 'to the forest and you are free.';
    this.startBtn.textContent = 'START THE ESCAPE';
    this.startBtn.classList.remove('hidden');
    this.againBtn.classList.add('hidden');
    this.overlay.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.setStatus('Gobble Run title screen. Press Start to play.');
  }

  showHud() { this.hud.classList.remove('hidden'); }
  hideOverlay() { this.overlay.classList.add('hidden'); }

  setStatus(text) { this.statusEl.textContent = text; }

  showToast(text) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTimer = 1.6;
  }

  /** A few props ahead of the turkey so the title screen is already a farm scene. */
  spawnDecor() {
    const hay = buildObstacle('hay');
    hay.position.set(LANES[2], 0, -24);
    this.scene.add(hay);
    this.obstacles.push(hay);
    const oven = buildObstacle('oven');
    oven.position.set(LANES[0], 0, -16);
    this.scene.add(oven);
    this.obstacles.push(oven);
    const pumpkin = buildObstacle('pumpkin');
    pumpkin.position.set(LANES[1], 0, -30);
    this.scene.add(pumpkin);
    this.obstacles.push(pumpkin);
    const corn = buildCorn();
    corn.position.set(LANES[1], 1.0, -10);
    this.scene.add(corn);
    this.pickups.push(corn);
  }

  spawnRow() {
    const d = Math.min(this.distance / ESCAPE_DISTANCE, 1);
    const z = SPAWN_AHEAD + this.rng.range(-2, 2);
    const roll = this.rng.next();
    const lanes = [0, 1, 2];
    const shuffled = [...lanes].sort(() => this.rng.next() - 0.5);

    const addObstacle = (kind, laneIndex, zOff = 0) => {
      const ob = buildObstacle(kind);
      ob.position.set(LANES[laneIndex], 0, z + zOff);
      this.scene.add(ob);
      this.obstacles.push(ob);
    };
    const addCornLine = (laneIndex, count = 3) => {
      for (let i = 0; i < count; i += 1) {
        const corn = buildCorn();
        corn.position.set(LANES[laneIndex], 1.0, z - i * 1.8);
        this.scene.add(corn);
        this.pickups.push(corn);
      }
    };
    const addBerry = (laneIndex) => {
      const berry = buildBerry();
      berry.position.set(LANES[laneIndex], 0.95, z);
      this.scene.add(berry);
      this.pickups.push(berry);
    };

    if (roll < 0.3) {
      // One hazard, corn in a free lane.
      addObstacle(this.rng.pick(['hay', 'fence', 'pumpkin']), shuffled[0]);
      addCornLine(shuffled[1]);
    } else if (roll < 0.55) {
      // Two jumpable hazards, one lane free.
      addObstacle(this.rng.pick(['hay', 'fence', 'pumpkin']), shuffled[0]);
      addObstacle(this.rng.pick(['hay', 'fence', 'pumpkin']), shuffled[1], 1.5);
      addCornLine(shuffled[2]);
    } else if (roll < 0.72 && d > 0.12) {
      // The swinging knife plus a low hazard elsewhere.
      addObstacle('knife', shuffled[0]);
      addObstacle(this.rng.pick(['hay', 'pumpkin']), shuffled[1]);
      addBerry(shuffled[2]);
    } else if (roll < 0.86 && d > 0.25) {
      // The hot oven: change lane or else.
      addObstacle('oven', shuffled[0]);
      addObstacle('fence', shuffled[1]);
      addCornLine(shuffled[2]);
    } else {
      // A breather: a corn feast, maybe a single hay bale to hop.
      addCornLine(shuffled[0], 4);
      if (this.rng.chance(0.5)) addObstacle('hay', shuffled[1], 3);
      addBerry(shuffled[2]);
    }
  }

  /** One logic tick. `actions` are edge-triggered inputs for this tick. */
  step(dt, actions) {
    this.time += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }

    if (this.state === GameState.TITLE) {
      // Idle farm: the turkey bobs, the farmer paces, the world drifts by.
      this.world.update(dt, 4, this.time);
      this.animateTurkey(dt, 4);
      this.animateFarmer(dt, 4);
      this.farmer.group.position.set(
        Math.sin(this.time * 0.5) * 1.2, 0, 1.6 + this.gap * 0.22,
      );
      this.camera.position.set(Math.sin(this.time * 0.12) * 1.2, 4.8, 9.8);
      this.camera.lookAt(0, 0.6, -8);
      return;
    }
    if (this.state === GameState.CAUGHT || this.state === GameState.ESCAPED) {
      this.world.update(dt, 0, this.time);
      if (this.state === GameState.CAUGHT) {
        // The farmer closes in and grabs the turkey.
        const f = this.farmer.group.position;
        f.z += (0.9 - f.z) * Math.min(1, dt * 2.5);
        f.x += (this.turkeyX - f.x) * Math.min(1, dt * 3);
        this.animateFarmer(dt, 2);
      } else {
        // Freedom dance: the turkey hops and flaps; the farmer gives up and
        // trudges back out of frame, defeated.
        this.turkey.group.position.y = Math.abs(Math.sin(this.time * 5)) * 0.5;
        this.turkey.wingL.rotation.z = 0.5 + Math.sin(this.time * 9) * 0.45;
        this.turkey.wingR.rotation.z = -0.5 - Math.sin(this.time * 9) * 0.45;
        const f = this.farmer.group.position;
        f.z += (11.5 - f.z) * Math.min(1, dt * 1.2);
        this.farmer.legL.rotation.x = 0;
        this.farmer.legR.rotation.x = 0;
        this.farmer.armL.rotation.x = 0.15;
        this.farmer.armR.rotation.x = 0.15;
      }
      this.camera.lookAt(this.turkeyX * 0.5, 0.6, -8);
      return;
    }
    if (this.state !== GameState.PLAYING) return;

    // --- Input ---
    for (const action of actions) {
      if (action === 'left' && this.laneIndex > 0) this.laneIndex -= 1;
      else if (action === 'right' && this.laneIndex < 2) this.laneIndex += 1;
      else if (action === 'jump' && this.grounded) {
        this.vy = JUMP_SPEED;
        this.grounded = false;
        this.sfx.jump();
      } else if (action === 'slide' && this.grounded) {
        this.sliding = true;
        this.slideTimer = 0.65;
        this.sfx.slide();
      }
    }

    // --- Speed, distance, score, farmer gap ---
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + (this.distance / ESCAPE_DISTANCE) * 7);
    this.distance += this.speed * dt;
    this.score = Math.floor(this.distance) + this.cornCollected * CORN_SCORE + this.berriesCollected * BERRY_SCORE;
    this.gap -= GAP_DRAIN_PER_SEC * dt;
    if (this.distance >= ESCAPE_DISTANCE) {
      this.endGame(false);
      return;
    }
    if (this.gap <= 0) {
      this.endGame(true);
      return;
    }

    // --- Turkey physics ---
    const targetX = LANES[this.laneIndex];
    this.turkeyX += (targetX - this.turkeyX) * Math.min(1, dt * 12);
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.turkeyY += this.vy * dt;
      if (this.turkeyY <= 0) {
        this.turkeyY = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    const turkey = this.turkey.group;
    turkey.position.set(this.turkeyX, this.turkeyY, 0);
    turkey.scale.y = this.sliding ? 0.55 : 1;

    // --- Spawning ---
    if (this.distance >= this.nextSpawnAt) {
      this.spawnRow();
      this.nextSpawnAt += this.rng.range(18, 27);
    }

    // --- Obstacles: move, swing, collide, recycle ---
    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const ob = this.obstacles[i];
      ob.position.z += this.speed * dt;
      if (ob.userData.kind === 'knife' && ob.userData.arm) {
        ob.userData.arm.rotation.z = Math.sin(this.time * 3.2 + ob.position.x) * 0.55;
      }
      if (ob.position.z > DESPAWN_BEHIND) {
        this.scene.remove(ob);
        this.obstacles.splice(i, 1);
        continue;
      }
      const dz = Math.abs(ob.position.z);
      const sameLane = Math.abs(ob.position.x - this.turkeyX) < 1.15;
      if (dz < 1.0 && sameLane && this.invulnTimer <= 0) {
        const clearsByJump = ob.userData.jumpable && this.turkeyY > 0.85;
        const clearsBySlide = ob.userData.slideable && this.sliding;
        if (!clearsByJump && !clearsBySlide) {
          this.lives -= 1;
          this.hits += 1;
          this.gap -= GAP_PER_HIT;
          this.invulnTimer = INVULN_SECONDS;
          this.shake = 0.6;
          this.sfx.crash();
          this.sfx.farmerYell();
          this.showToast(this.lives > 0 ? 'OUCH! The farmer is gaining!' : 'The farmer has you!');
          this.scene.remove(ob);
          this.obstacles.splice(i, 1);
          if (this.lives <= 0) {
            this.endGame(true);
            return;
          }
        }
      }
    }

    // --- Pickups: move, spin, collect, recycle ---
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const p = this.pickups[i];
      p.position.z += this.speed * dt;
      p.rotation.y += dt * 3;
      if (p.position.z > DESPAWN_BEHIND) {
        this.scene.remove(p);
        this.pickups.splice(i, 1);
        continue;
      }
      const dz = Math.abs(p.position.z);
      const sameLane = Math.abs(p.position.x - this.turkeyX) < 1.15;
      if (dz < 1.1 && sameLane && this.turkeyY < 1.6) {
        if (p.userData.kind === 'corn') {
          this.cornCollected += 1;
          this.gap = Math.min(START_GAP, this.gap + GAP_PER_CORN);
          this.showToast(`Corn! +${CORN_SCORE}`);
        } else {
          this.berriesCollected += 1;
          this.showToast(`Cranberries! +${BERRY_SCORE}`);
        }
        this.sfx.coin();
        this.scene.remove(p);
        this.pickups.splice(i, 1);
      }
    }

    // --- Milestone toasts ---
    const remaining = ESCAPE_DISTANCE - this.distance;
    if (remaining < 500 && !this._t500) { this._t500 = true; this.showToast('Halfway there — 500 m to freedom!'); }
    if (remaining < 200 && !this._t200) { this._t200 = true; this.showToast('200 m to go! The forest is close!'); }
    if (this.gap < 5 && !this._tGap) { this._tGap = true; this.showToast('The farmer is RIGHT behind you! Grab corn!'); }
    if (this.gap > 8) this._tGap = false;

    // --- Animation, world, camera ---
    this.world.update(dt, this.speed, this.time);
    this.animateTurkey(dt, this.speed);
    this.animateFarmer(dt, this.speed);
    if (this.invulnTimer > 0) turkey.visible = Math.floor(this.time * 12) % 2 === 0;
    else turkey.visible = true;

    const camTargetX = this.turkeyX * 0.45;
    this.camera.position.x += (camTargetX - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y = 4.8 + this.turkeyY * 0.12;
    this.camera.position.z = 9.8;
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    this.camera.lookAt(this.turkeyX * 0.6, 0.6, -8);
    this.updateHud();
  }

  animateTurkey(dt, speed) {
    this.runPhase += dt * speed * 1.7;
    const swing = Math.sin(this.runPhase);
    if (this.grounded && !this.sliding) {
      this.turkey.legL.rotation.x = swing * 0.8;
      this.turkey.legR.rotation.x = -swing * 0.8;
      this.turkey.wingL.rotation.z = 0.15 + swing * 0.12;
      this.turkey.wingR.rotation.z = -0.15 - swing * 0.12;
      this.turkey.group.position.y = this.turkeyY + Math.abs(Math.cos(this.runPhase)) * 0.06;
    } else if (!this.grounded) {
      this.turkey.legL.rotation.x = -0.5;
      this.turkey.legR.rotation.x = 0.4;
      this.turkey.wingL.rotation.z = 0.5;
      this.turkey.wingR.rotation.z = -0.5;
    } else {
      this.turkey.legL.rotation.x = 0.9;
      this.turkey.legR.rotation.x = 0.9;
    }
    this.turkey.tail.rotation.y = Math.sin(this.time * 2.2) * 0.12;
  }

  animateFarmer(dt, speed) {
    const phase = this.time * (6 + speed * 0.55);
    const swing = Math.sin(phase);
    this.farmer.legL.rotation.x = swing * 0.75;
    this.farmer.legR.rotation.x = -swing * 0.75;
    this.farmer.armL.rotation.x = -swing * 0.6;
    this.farmer.armR.rotation.x = swing * 0.6 - 0.5;
    const visualGap = 1.6 + this.gap * 0.22;
    const f = this.farmer.group.position;
    f.z += (visualGap - f.z) * Math.min(1, dt * 2);
    f.x += (this.turkeyX * 0.85 - f.x) * Math.min(1, dt * 3);
    f.y = Math.abs(Math.cos(phase)) * 0.07;
  }

  updateHud() {
    this.scoreEl.textContent = String(this.score);
    this.distEl.textContent = String(Math.floor(this.distance));
    this.livesEl.innerHTML = '&#10084;'.repeat(this.lives) + '&#9825;'.repeat(Math.max(0, START_LIVES - this.lives));
    const pct = Math.max(0, Math.min(100, (this.gap / START_GAP) * 100));
    this.farmerFill.style.width = `${pct}%`;
    this.farmerLabel.textContent = this.gap < 4
      ? 'The farmer is RIGHT behind you!'
      : `Farmer ${Math.max(0, this.gap).toFixed(0)} m behind you`;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Boot.
const canvas = document.getElementById('game');
const game = new Game(canvas);
game.init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Gobble Run failed to start:', err);
  document.getElementById('cardText').textContent = `The game could not start: ${err.message}`;
});

