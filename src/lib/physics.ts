import type { SphereData } from '../gpu/raytracer';

type Vec3 = [number, number, number];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}
function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len > 1e-8 ? scale(v, 1 / len) : [0, 0, 0];
}

const GRAVITY: Vec3 = [0, -9.8, 0];
const GROUND_Y = 0;
const LINEAR_DAMPING = 0.999;
const FIXED_DT = 1 / 120;
const VELOCITY_SLEEP_THRESHOLD = 0.01;

export interface PhysicsState {
  positions: Vec3[];
  velocities: Vec3[];
  accumulator: number;
}

export function createPhysicsState(spheres: SphereData[]): PhysicsState {
  return {
    positions: spheres.map((s) => [...s.center] as Vec3),
    velocities: spheres.map((s) => [...s.velocity] as Vec3),
    accumulator: 0,
  };
}

function massFromRadius(r: number): number {
  return (4 / 3) * Math.PI * r * r * r;
}

function stepOnce(positions: Vec3[], velocities: Vec3[], spheres: SphereData[], dt: number): void {
  const n = spheres.length;

  // Apply gravity & integrate velocity
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= 100) continue; // skip ground
    velocities[i] = add(velocities[i], scale(GRAVITY, dt));
    velocities[i] = scale(velocities[i], LINEAR_DAMPING);
  }

  // Integrate position
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= 100) continue;
    positions[i] = add(positions[i], scale(velocities[i], dt));
  }

  // Ground collision
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= 100) continue;
    const r = spheres[i].radius;
    const minY = GROUND_Y + r;
    if (positions[i][1] < minY) {
      positions[i][1] = minY;
      if (velocities[i][1] < 0) {
        velocities[i][1] = -velocities[i][1] * spheres[i].elasticity;
        // Apply friction to horizontal
        velocities[i][0] *= 0.98;
        velocities[i][2] *= 0.98;
      }
      // Sleep if barely moving
      if (
        Math.abs(velocities[i][1]) < VELOCITY_SLEEP_THRESHOLD &&
        positions[i][1] <= minY + 0.001
      ) {
        velocities[i][1] = 0;
      }
    }
  }

  // Sphere-sphere collision
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= 100) continue;
    for (let j = i + 1; j < n; j++) {
      if (spheres[j].radius >= 100) continue;
      const diff = sub(positions[i], positions[j]);
      const dist = length(diff);
      const minDist = spheres[i].radius + spheres[j].radius;
      if (dist < minDist && dist > 1e-8) {
        const normal = normalize(diff);
        // Separate
        const overlap = minDist - dist;
        const m1 = massFromRadius(spheres[i].radius);
        const m2 = massFromRadius(spheres[j].radius);
        const totalMass = m1 + m2;
        positions[i] = add(positions[i], scale(normal, overlap * (m2 / totalMass)));
        positions[j] = sub(positions[j], scale(normal, overlap * (m1 / totalMass)));

        // Impulse
        const relVel = sub(velocities[i], velocities[j]);
        const velAlongNormal = dot(relVel, normal);
        if (velAlongNormal > 0) continue; // separating

        const e = (spheres[i].elasticity + spheres[j].elasticity) / 2;
        const impulse = (-(1 + e) * velAlongNormal) / (1 / m1 + 1 / m2);
        velocities[i] = add(velocities[i], scale(normal, impulse / m1));
        velocities[j] = sub(velocities[j], scale(normal, impulse / m2));
      }
    }
  }
}

/**
 * Advance physics by deltaTime seconds.
 * Returns updated spheres with new positions/velocities.
 */
export function stepPhysics(
  state: PhysicsState,
  spheres: SphereData[],
  deltaTime: number
): SphereData[] {
  state.accumulator += deltaTime;

  // Cap accumulator to avoid spiral of death
  if (state.accumulator > 0.1) state.accumulator = 0.1;

  while (state.accumulator >= FIXED_DT) {
    stepOnce(state.positions, state.velocities, spheres, FIXED_DT);
    state.accumulator -= FIXED_DT;
  }

  // Return spheres with updated positions and velocities
  return spheres.map((s, i) => ({
    ...s,
    center: [...state.positions[i]] as [number, number, number],
    velocity: [...state.velocities[i]] as [number, number, number],
  }));
}
