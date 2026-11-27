// Shared tuning for Gobble Run. All distances in metres, speeds in metres/second.
export const LANES = [-2.3, 0, 2.3];
export const ESCAPE_DISTANCE = 1000;
export const START_LIVES = 3;
export const START_GAP = 14; // metres between the turkey and the farmer
export const GAP_DRAIN_PER_SEC = 0.1; // the farmer never stops gaining
export const GAP_PER_CORN = 0.4; // corn buys a little breathing room
export const GAP_PER_HIT = 3.0; // a crash lets the farmer close in
export const BASE_SPEED = 10;
export const MAX_SPEED = 17;
export const SPAWN_AHEAD = -95; // z where new rows appear
export const DESPAWN_BEHIND = 14; // z where old rows are recycled
export const GRAVITY = 30;
export const JUMP_SPEED = 11.5;
export const CORN_SCORE = 50;
export const BERRY_SCORE = 25;
export const INVULN_SECONDS = 1.6;

// Warm golden-hour farm palette.
export const COLORS = {
  skyFog: 0xf2cf96,
  sun: 0xffe3b3,
  grass: 0x7fae4c,
  dirt: 0xc99a5b,
  turkeyBrown: 0x6b4423,
  turkeyDark: 0x4a2c14,
  featherOrange: 0xc96a1e,
  featherRed: 0x9e2b12,
  beak: 0xf2b705,
  farmerShirt: 0x3a6ea5,
  farmerPants: 0x4a3626,
  farmerSkin: 0xe8b98a,
  straw: 0xe8c96a,
  ovenBody: 0x3c3c44,
  ovenGlow: 0xff6a00,
  blade: 0xd8dee6,
  pumpkin: 0xe8721c,
  hay: 0xd9a441,
};
