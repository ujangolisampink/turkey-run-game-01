// The autumn farm the turkey runs through: scrolling dirt path, grass, fences,
// trees, a barn, clouds and drifting leaves. Props recycle ahead of the camera
// so the farm feels endless; the ground scrolls through its texture offset.
import { makeRandom } from './random.js';
import { COLORS, SPAWN_AHEAD, DESPAWN_BEHIND } from './config.js';

const THREE = window.THREE;
const TRACK_LENGTH = 240;

export function loadTextures() {
  const loader = new THREE.TextureLoader();
  const names = ['grass', 'dirt', 'wood', 'sky'];
  return Promise.all(names.map((name) => new Promise((resolve, reject) => {
    loader.load(
      `./assets/${name}.jpg`,
      (tex) => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; resolve([name, tex]); },
      undefined,
      (err) => reject(new Error(`texture ${name} failed to load`)),
    );
  }))).then((entries) => Object.fromEntries(entries));
}

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

function makeTree(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 2.4, 8), lambert(0x6b4423));
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  group.add(trunk);
  const leafColors = [0xd96a1e, 0xc23b12, 0xe8a020, 0x7fae4c, 0xb8541a];
  const blobs = 3 + rng.int(0, 2);
  for (let i = 0; i < blobs; i += 1) {
    const r = rng.range(1.0, 1.7);
    const blob = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      lambert(rng.pick(leafColors), { flatShading: true }),
    );
    blob.position.set(rng.range(-0.9, 0.9), rng.range(2.6, 4.4), rng.range(-0.7, 0.7));
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

// Fences as instanced meshes: posts every 4 m from -240 to +12, two rails
// between them. Each instance recycles on its own (span 256, a multiple of
// the 4 m spacing) so the fence runs forever without a visible seam.
function makeFence(x) {
  const COUNT = 64;
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6);
  const posts = new THREE.InstancedMesh(postGeo, lambert(0x8a6a3f), COUNT);
  const railGeo = new THREE.BoxGeometry(0.07, 0.09, 4.1);
  const rails = new THREE.InstancedMesh(railGeo, lambert(0x9a7a4a), (COUNT - 1) * 2);
  posts.castShadow = true;
  const m = new THREE.Matrix4();
  const zs = [];
  for (let i = 0; i < COUNT; i += 1) {
    const z = -240 + i * 4;
    zs.push(z);
    m.makeTranslation(x, 0.55, z);
    posts.setMatrixAt(i, m);
  }
  const railZs = [];
  let ri = 0;
  for (let i = 0; i < COUNT - 1; i += 1) {
    const z = -238 + i * 4;
    railZs.push(z);
    for (const y of [0.45, 0.85]) {
      m.makeTranslation(x, y, z);
      rails.setMatrixAt(ri, m);
      ri += 1;
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  return { posts, rails, zs, railZs, x };
}

function makeBarn(woodTex) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: woodTex });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(11, 6, 8), wallMat);
  walls.position.y = 3;
  walls.castShadow = true;
  group.add(walls);
  const roofMat = lambert(0x5a3a22);
  for (const side of [-1, 1]) {
    // Each slab runs from the ridge (x 0, y 8) down to its eave (x ±5.5, y 6).
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 8.6), roofMat);
    slab.position.set(side * 2.75, 7.0, 0);
    slab.rotation.z = -side * 0.35;
    slab.castShadow = true;
    group.add(slab);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4, 0.15), lambert(0x3a2412));
  door.position.set(0, 2, 4.05);
  group.add(door);
  const loft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.15), lambert(0xfff2cc, { emissive: 0x886600 }));
  loft.position.set(0, 5.4, 4.05);
  group.add(loft);
  return group;
}

function makeCloud() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 4; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2.2, 10, 8), mat);
    puff.scale.y = 0.45;
    puff.position.set(i * 3 - 4.5 + Math.random(), Math.random() * 0.8, Math.random() * 2);
    group.add(puff);
  }
  return group;
}

export class World {
  constructor(scene, textures, rng) {
    this.scene = scene;
    this.rng = rng;
    this.textures = textures;
    this.movers = []; // props that scroll toward the camera and recycle
    this.leaves = [];

    scene.fog = new THREE.Fog(COLORS.skyFog, 45, 170);

    // Sky dome with the photographed autumn sky.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(280, 24, 12),
      new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);

    // Grass field.
    const grassTex = textures.grass.clone();
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(30, 26);
    grassTex.needsUpdate = true;
    this.grassTex = grassTex;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(320, TRACK_LENGTH),
      new THREE.MeshLambertMaterial({ map: grassTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -60);
    ground.receiveShadow = true;
    scene.add(ground);

    // Dirt path the turkey runs on.
    const dirtTex = textures.dirt.clone();
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.wrapT = THREE.RepeatWrapping;
    dirtTex.repeat.set(1, 26);
    dirtTex.needsUpdate = true;
    this.dirtTex = dirtTex;
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, TRACK_LENGTH),
      new THREE.MeshLambertMaterial({ map: dirtTex }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, -60);
    path.receiveShadow = true;
    scene.add(path);

    // Fences along both sides of the path.
    this.fences = [];
    for (const side of [-1, 1]) {
      const fence = makeFence(side * 4.6);
      scene.add(fence.posts);
      scene.add(fence.rails);
      this.fences.push(fence);
    }

    // Trees scattered on both sides.
    for (let i = 0; i < 26; i += 1) {
      const tree = makeTree(rng);
      const side = rng.chance(0.5) ? -1 : 1;
      tree.position.set(side * rng.range(8.5, 34), 0, rng.range(-TRACK_LENGTH + 30, 20));
      tree.scale.setScalar(rng.range(0.9, 1.7));
      scene.add(tree);
      this.movers.push({ obj: tree, span: TRACK_LENGTH, kind: 'tree' });
    }

    // A red barn that drifts past on the side, well clear of the path.
    this.barn = makeBarn(textures.wood);
    this.barn.position.set(-24, 0, -40);
    scene.add(this.barn);
    this.movers.push({ obj: this.barn, span: TRACK_LENGTH, kind: 'barn' });

    // Decorative pumpkins beside the path.
    for (let i = 0; i < 10; i += 1) {
      const pumpkin = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), lambert(COLORS.pumpkin, { flatShading: true }));
      body.scale.y = 0.8;
      body.position.y = 0.42;
      body.castShadow = true;
      pumpkin.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6), lambert(0x4a6b1e));
      stem.position.y = 0.9;
      pumpkin.add(stem);
      const side = rng.chance(0.5) ? -1 : 1;
      pumpkin.position.set(side * rng.range(5.6, 9), 0, rng.range(-TRACK_LENGTH + 30, 20));
      scene.add(pumpkin);
      this.movers.push({ obj: pumpkin, span: TRACK_LENGTH, kind: 'pumpkin' });
    }

    // Clouds high above.
    this.clouds = [];
    for (let i = 0; i < 7; i += 1) {
      const cloud = makeCloud();
      cloud.position.set(rng.range(-70, 70), rng.range(26, 44), rng.range(-160, 10));
      scene.add(cloud);
      this.clouds.push(cloud);
    }

    // Drifting autumn leaves around the camera.
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.3);
    const leafMats = [0xd96a1e, 0xe8a020, 0xc23b12].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    for (let i = 0; i < 46; i += 1) {
      const leaf = new THREE.Mesh(leafGeo, rng.pick(leafMats));
      leaf.position.set(rng.range(-14, 14), rng.range(0.4, 7), rng.range(-45, 8));
      leaf.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      leaf.userData.fall = rng.range(0.4, 1.0);
      leaf.userData.sway = rng.range(0.5, 1.5);
      scene.add(leaf);
      this.leaves.push(leaf);
    }
  }

  update(dt, speed, time) {
    // Scroll the ground textures so the farm rushes past.
    const scroll = (speed * dt) / 9.2;
    this.grassTex.offset.y += scroll;
    this.dirtTex.offset.y += scroll;

    // Scroll the fence instances, each recycling on its own.
    const m4 = new THREE.Matrix4();
    for (const fence of this.fences) {
      for (let i = 0; i < fence.zs.length; i += 1) {
        fence.zs[i] += speed * dt;
        if (fence.zs[i] > 14) fence.zs[i] -= 256;
        m4.makeTranslation(fence.x, 0.55, fence.zs[i]);
        fence.posts.setMatrixAt(i, m4);
      }
      fence.posts.instanceMatrix.needsUpdate = true;
      let ri = 0;
      for (let i = 0; i < fence.railZs.length; i += 1) {
        fence.railZs[i] += speed * dt;
        if (fence.railZs[i] > 14) fence.railZs[i] -= 256;
        for (const y of [0.45, 0.85]) {
          m4.makeTranslation(fence.x, y, fence.railZs[i]);
          fence.rails.setMatrixAt(ri, m4);
          ri += 1;
        }
      }
      fence.rails.instanceMatrix.needsUpdate = true;
    }

    for (const mover of this.movers) {
      mover.obj.position.z += speed * dt;
      if (mover.obj.position.z > DESPAWN_BEHIND + 30) {
        mover.obj.position.z -= mover.span;
        if (mover.kind === 'tree') {
          const side = this.rng.chance(0.5) ? -1 : 1;
          mover.obj.position.x = side * this.rng.range(8.5, 34);
        }
        if (mover.kind === 'pumpkin') {
          const side = this.rng.chance(0.5) ? -1 : 1;
          mover.obj.position.x = side * this.rng.range(5.6, 9);
        }
        if (mover.kind === 'barn') mover.obj.position.x = this.rng.chance(0.5) ? -24 : 24;
      }
    }
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.4;
      if (cloud.position.x > 80) cloud.position.x = -80;
    }
    for (const leaf of this.leaves) {
      leaf.position.y -= leaf.userData.fall * dt;
      leaf.position.x += Math.sin(time * leaf.userData.sway + leaf.position.z) * dt * 0.7;
      leaf.position.z += speed * dt * 0.25;
      leaf.rotation.x += dt * 1.4;
      leaf.rotation.z += dt * 0.9;
      if (leaf.position.y < 0.1) {
        leaf.position.y = this.rng.range(5, 7.5);
        leaf.position.z = this.rng.range(-45, -20);
      }
      if (leaf.position.z > 10) leaf.position.z = -45;
    }
  }
}
