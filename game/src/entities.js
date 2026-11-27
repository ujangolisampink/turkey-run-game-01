// The characters and hazards, all built from rounded geometry with the farm
// palette: a plump turkey, a farmer in a straw hat with a carving knife, and
// the things between them — hay bales, fences, pumpkins, a hot oven and a
// swinging carving knife — plus corn and cranberries to collect.
import { COLORS } from './config.js';

const THREE = window.THREE;

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** The hero: a plump brown turkey with a fanned tail, facing -z (away from camera). */
export function buildTurkey() {
  const group = new THREE.Group();
  const brown = lambert(COLORS.turkeyBrown);
  const dark = lambert(COLORS.turkeyDark);

  const body = mesh(new THREE.SphereGeometry(0.55, 18, 14), brown, 0, 0.95, 0);
  body.scale.set(1, 0.95, 1.25);
  group.add(body);

  // Fanned tail: five flattened cones in autumn colours, tilted back.
  const tailColors = [COLORS.featherRed, COLORS.featherOrange, 0x8a5a1e, COLORS.featherOrange, COLORS.featherRed];
  const tail = new THREE.Group();
  tail.position.set(0, 1.15, 0.55);
  tailColors.forEach((c, i) => {
    const feather = mesh(new THREE.ConeGeometry(0.26, 1.0, 4), lambert(c), (i - 2) * 0.3, 0.35, 0);
    feather.scale.set(1, 1, 0.28);
    feather.rotation.x = -0.55;
    feather.rotation.z = (i - 2) * -0.22;
    tail.add(feather);
  });
  group.add(tail);

  // Neck, head, beak, wattle, eyes.
  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), dark, 0, 1.5, -0.42);
  neck.rotation.x = 0.25;
  group.add(neck);
  const head = mesh(new THREE.SphereGeometry(0.24, 14, 10), brown, 0, 1.82, -0.52);
  group.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.08, 0.26, 8), lambert(COLORS.beak), 0, 1.8, -0.76);
  beak.rotation.x = -Math.PI / 2;
  group.add(beak);
  const wattle = mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert(0xc22e2e), 0, 1.66, -0.68);
  wattle.scale.set(0.8, 1.4, 0.8);
  group.add(wattle);
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.035, 6, 6), lambert(0x111111), side * 0.1, 1.88, -0.68));
  }

  // Wings (pivot at the shoulder so they can flap) and legs.
  const wingGeo = new THREE.SphereGeometry(0.3, 12, 8);
  const wingL = new THREE.Group();
  wingL.position.set(-0.5, 1.05, 0);
  const wingLMesh = mesh(wingGeo, dark, -0.08, -0.05, 0);
  wingLMesh.scale.set(0.4, 1, 1.3);
  wingL.add(wingLMesh);
  group.add(wingL);
  const wingR = new THREE.Group();
  wingR.position.set(0.5, 1.05, 0);
  const wingRMesh = mesh(wingGeo, dark, 0.08, -0.05, 0);
  wingRMesh.scale.set(0.4, 1, 1.3);
  wingR.add(wingRMesh);
  group.add(wingR);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6);
  const legL = new THREE.Group();
  legL.position.set(-0.2, 0.55, 0);
  legL.add(mesh(legGeo, lambert(0xe8721c), 0, -0.2, 0));
  group.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.2, 0.55, 0);
  legR.add(mesh(legGeo, lambert(0xe8721c), 0, -0.2, 0));
  group.add(legR);

  return { group, wingL, wingR, legL, legR, tail, body };
}

/** The pursuer: a farmer in a straw hat, blue shirt and brown trousers, knife in hand. */
export function buildFarmer() {
  const group = new THREE.Group();
  const shirt = lambert(COLORS.farmerShirt);
  const pants = lambert(COLORS.farmerPants);
  const skin = lambert(COLORS.farmerSkin);

  const torso = mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.85, 12), shirt, 0, 1.25, 0);
  group.add(torso);
  // Overall straps.
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.05), lambert(0x2e4a6b), side * 0.16, 1.5, -0.36));
  }

  const legGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8);
  const legL = new THREE.Group();
  legL.position.set(-0.18, 0.85, 0);
  legL.add(mesh(legGeo, pants, 0, -0.42, 0));
  group.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.18, 0.85, 0);
  legR.add(mesh(legGeo, pants, 0, -0.42, 0));
  group.add(legR);
  // Boots.
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.22, 0.12, 0.4), lambert(0x3a2412), side * 0.18, 0.06, -0.06));
  }

  const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.7, 8);
  const armL = new THREE.Group();
  armL.position.set(-0.44, 1.6, 0);
  armL.add(mesh(armGeo, shirt, 0, -0.32, 0));
  group.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.44, 1.6, 0);
  armR.add(mesh(armGeo, shirt, 0, -0.32, 0));
  // Carving knife in the right hand: dark handle, long steel blade.
  const handle = mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), lambert(0x2a1a0e), 0, -0.72, -0.05);
  armR.add(handle);
  const blade = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.16), lambert(COLORS.blade, { emissive: 0x222222 }), 0, -0.72, -0.42);
  blade.rotation.x = 0.5;
  armR.add(blade);
  group.add(armR);

  const head = mesh(new THREE.SphereGeometry(0.27, 14, 10), skin, 0, 1.95, 0);
  group.add(head);
  // Straw hat: wide brim + domed crown.
  const brim = mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.05, 16), lambert(COLORS.straw), 0, 2.12, 0);
  group.add(brim);
  const crown = mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(COLORS.straw), 0, 2.12, 0);
  group.add(crown);
  // Face: eyes, nose, big mustache.
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.035, 6, 6), lambert(0x111111), side * 0.1, 1.99, -0.24));
  }
  group.add(mesh(new THREE.SphereGeometry(0.05, 6, 6), skin, 0, 1.9, -0.27));
  const mustache = mesh(new THREE.BoxGeometry(0.24, 0.06, 0.06), lambert(0x6b4423), 0, 1.84, -0.26);
  group.add(mustache);

  return { group, legL, legR, armL, armR, torso };
}

/**
 * Hazards. `jumpable` means a jump clears it; `slideable` means sliding under it
 * clears it; the oven is neither — it is too hot to jump on and too tall to slide under.
 */
export function buildObstacle(kind) {
  const group = new THREE.Group();
  let jumpable = false;
  let slideable = false;
  let height = 1;

  if (kind === 'hay') {
    const bale = mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.15, 14), lambert(COLORS.hay), 0, 0.72, 0);
    bale.rotation.z = Math.PI / 2;
    group.add(bale);
    for (const x of [-0.35, 0.35]) {
      const band = mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 18), lambert(0x8a6a1e), x, 0.72, 0);
      band.rotation.y = Math.PI / 2;
      group.add(band);
    }
    jumpable = true;
    height = 1.45;
  } else if (kind === 'fence') {
    for (const x of [-0.85, 0.85]) {
      group.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6), lambert(0x8a6a3f), x, 0.5, 0));
    }
    for (const y of [0.4, 0.8]) {
      group.add(mesh(new THREE.BoxGeometry(1.9, 0.09, 0.07), lambert(0x9a7a4a), 0, y, 0));
    }
    jumpable = true;
    height = 1.0;
  } else if (kind === 'pumpkin') {
    const body = mesh(new THREE.SphereGeometry(0.58, 14, 10), lambert(COLORS.pumpkin, { flatShading: true }), 0, 0.45, 0);
    body.scale.y = 0.82;
    group.add(body);
    group.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.28, 6), lambert(0x4a6b1e), 0, 0.95, 0));
    const small = mesh(new THREE.SphereGeometry(0.34, 10, 8), lambert(COLORS.pumpkin, { flatShading: true }), 0.62, 0.26, 0.25);
    small.scale.y = 0.82;
    group.add(small);
    jumpable = true;
    height = 1.1;
  } else if (kind === 'oven') {
    const bodyMat = lambert(COLORS.ovenBody);
    const body = mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.7, 16), bodyMat, 0, 0.85, 0);
    group.add(body);
    // Glowing door facing the turkey (+z side) and a hot fire light.
    const door = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x331500, emissive: COLORS.ovenGlow, emissiveIntensity: 0.9 }), 0, 0.75, 0.98);
    group.add(door);
    const doorFrame = mesh(new THREE.BoxGeometry(1.1, 1.1, 0.05), lambert(0x222228), 0, 0.75, 0.96);
    doorFrame.position.z = 0.94;
    group.add(doorFrame);
    group.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8), bodyMat, 0.4, 2.0, -0.2));
    const glow = new THREE.PointLight(0xff6a00, 0.9, 7);
    glow.position.set(0, 1.0, 1.6);
    group.add(glow);
    height = 2.2;
  } else if (kind === 'knife') {
    // A carving knife on a swinging arm, mounted on a post at the lane's edge.
    const post = mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8), lambert(0x6b4423), -1.05, 1.2, 0);
    group.add(post);
    const arm = new THREE.Group();
    arm.position.set(-1.05, 2.3, 0);
    const beam = mesh(new THREE.BoxGeometry(1.9, 0.09, 0.09), lambert(0x4a3626), 0.95, 0, 0);
    arm.add(beam);
    const blade = mesh(new THREE.BoxGeometry(0.05, 1.15, 0.3),
      lambert(COLORS.blade, { emissive: 0x222222 }), 1.85, -0.65, 0);
    arm.add(blade);
    const handle = mesh(new THREE.BoxGeometry(0.09, 0.3, 0.1), lambert(0x2a1a0e), 1.85, -0.05, 0);
    arm.add(handle);
    group.add(arm);
    group.userData.arm = arm;
    slideable = true;
    height = 2.3;
  }
  group.userData.kind = kind;
  group.userData.jumpable = jumpable;
  group.userData.slideable = slideable;
  group.userData.height = height;
  return group;
}

export function buildCorn() {
  const group = new THREE.Group();
  const cob = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), lambert(0xf2c200), 0, 0, 0);
  cob.rotation.x = 0.6;
  group.add(cob);
  for (const side of [-1, 1]) {
    const husk = mesh(new THREE.ConeGeometry(0.09, 0.35, 6), lambert(0x4a8a2e), side * 0.08, -0.2, 0.08);
    husk.rotation.x = 0.9;
    group.add(husk);
  }
  group.position.y = 1.0;
  group.userData.kind = 'corn';
  return group;
}

export function buildBerry() {
  const group = new THREE.Group();
  for (const [x, y, z] of [[0, 0, 0], [0.16, 0.08, 0.06], [-0.14, 0.1, -0.04]]) {
    group.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), lambert(0xb81f2e, { emissive: 0x330000 }), x, y, z));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5), lambert(0x4a6b1e), 0, 0.2, 0));
  group.position.y = 0.95;
  group.userData.kind = 'berry';
  return group;
}
