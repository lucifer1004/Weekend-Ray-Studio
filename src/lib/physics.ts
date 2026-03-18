import type { SphereData } from '../gpu/raytracer';
import type { GroundSettings } from './scene-dsl';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number]; // w, x, y, z

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
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function quatMultiply(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

function quatNormalize(q: Quat): Quat {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len < 1e-10) return [1, 0, 0, 0];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  return [Math.cos(half), axis[0] * s, axis[1] * s, axis[2] * s];
}

const LINEAR_DAMPING = 0.999;
const FIXED_DT = 1 / 120;
const VELOCITY_SLEEP_THRESHOLD = 0.01;
const GROUND_RADIUS_THRESHOLD = 100; // Spheres with radius >= this are ground

export interface PhysicsState {
  positions: Vec3[];
  velocities: Vec3[];
  angularVelocities: Vec3[];
  orientations: Quat[];
  accumulator: number;
}

export function createPhysicsState(spheres: SphereData[]): PhysicsState {
  return {
    positions: spheres.map((s) => [...s.center] as Vec3),
    velocities: spheres.map((s) => [...s.velocity] as Vec3),
    angularVelocities: spheres.map(() => [0, 0, 0] as Vec3),
    orientations: spheres.map((s) =>
      s.orientation ? ([...s.orientation] as Quat) : ([1, 0, 0, 0] as Quat)
    ),
    accumulator: 0,
  };
}

/** Get ground normal vector accounting for tilt */
function getGroundNormal(ground: GroundSettings): Vec3 {
  const nx = -Math.sin(ground.tiltZ);
  const ny = 1.0;
  const nz = -Math.sin(ground.tiltX);
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return [nx / len, ny / len, nz / len];
}

/** Get gravity vector accounting for ground tilt */
function getGravityVector(ground: GroundSettings): Vec3 {
  const g = 9.8;
  const tiltX = ground.tiltX;
  const tiltZ = ground.tiltZ;

  // Gravity acceleration along X (due to Z tilt): g * sin(tiltZ)
  // Gravity acceleration along Y (effective): -g * cos(tiltX) * cos(tiltZ)
  // Gravity acceleration along Z (due to X tilt): -g * sin(tiltX)
  return [g * Math.sin(tiltZ), -g * Math.cos(tiltX) * Math.cos(tiltZ), -g * Math.sin(tiltX)];
}

/** Check collision with tilted ground plane */
function checkGroundCollision(
  center: Vec3,
  radius: number,
  ground: GroundSettings
): { collided: boolean; normal: Vec3; penetration: number } {
  const normal = getGroundNormal(ground);
  // Distance from center to plane: d = dot(center, normal)
  // Plane passes through origin: ax + by + cz = 0, normal = (a, b, c)
  const d = dot(center, normal);
  // Penetration depth: how much the sphere has sunk into the ground
  const penetration = radius - d;

  if (penetration > 0) {
    return { collided: true, normal, penetration };
  }
  return { collided: false, normal, penetration: 0 };
}

function massFromRadius(r: number): number {
  return (4 / 3) * Math.PI * r * r * r;
}

function stepOnce(
  positions: Vec3[],
  velocities: Vec3[],
  angularVelocities: Vec3[],
  orientations: Quat[],
  spheres: SphereData[],
  ground: GroundSettings,
  dt: number
): void {
  const n = spheres.length;
  const gravity = getGravityVector(ground);

  // Apply gravity & integrate velocity
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= GROUND_RADIUS_THRESHOLD) continue; // skip ground
    velocities[i] = add(velocities[i], scale(gravity, dt));
    velocities[i] = scale(velocities[i], LINEAR_DAMPING);
  }

  // Integrate position
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= GROUND_RADIUS_THRESHOLD) continue;
    positions[i] = add(positions[i], scale(velocities[i], dt));
  }

  // Integrate orientation from angular velocity
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= GROUND_RADIUS_THRESHOLD) continue;
    const omega = angularVelocities[i];
    const speed = length(omega);
    if (speed > 1e-8) {
      const axis = normalize(omega);
      const deltaQ = quatFromAxisAngle(axis, speed * dt);
      orientations[i] = quatNormalize(quatMultiply(deltaQ, orientations[i]));
    }
  }

  // Ground collision with tilted plane
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= GROUND_RADIUS_THRESHOLD) continue;
    const r = spheres[i].radius;
    const center = positions[i];

    const collision = checkGroundCollision(center, r, ground);
    if (collision.collided) {
      // Push sphere out of ground along normal
      positions[i] = add(center, scale(collision.normal, collision.penetration));

      // Reflect velocity along normal with elasticity
      const velDotNormal = dot(velocities[i], collision.normal);
      if (velDotNormal < 0) {
        // Velocity pointing into ground - reflect
        const e = spheres[i].elasticity;
        velocities[i] = sub(velocities[i], scale(collision.normal, (1 + e) * velDotNormal));

        // Apply friction to tangential velocity (in the ground plane, not world-space axes)
        const normalVelMag = dot(velocities[i], collision.normal);
        const normalVelVec = scale(collision.normal, normalVelMag);
        const tangentVel = sub(velocities[i], normalVelVec);
        velocities[i] = add(scale(tangentVel, 0.98), normalVelVec);

        // Sleep if barely bouncing along normal — zero the normal component, preserve tangential sliding
        if (Math.abs(velDotNormal) < VELOCITY_SLEEP_THRESHOLD) {
          const curNormalVel = dot(velocities[i], collision.normal);
          velocities[i] = sub(velocities[i], scale(collision.normal, curNormalVel));
        }
      }

      // Rolling without slipping: ω = (normal × v_tangent) / radius
      const nv = dot(velocities[i], collision.normal);
      const tangent = sub(velocities[i], scale(collision.normal, nv));
      angularVelocities[i] = scale(cross(collision.normal, tangent), 1 / r);
    }
  }

  // Sphere-sphere collision
  for (let i = 0; i < n; i++) {
    if (spheres[i].radius >= GROUND_RADIUS_THRESHOLD) continue;
    for (let j = i + 1; j < n; j++) {
      if (spheres[j].radius >= GROUND_RADIUS_THRESHOLD) continue;
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
  ground: GroundSettings,
  deltaTime: number
): SphereData[] {
  state.accumulator += deltaTime;

  // Cap accumulator to avoid spiral of death
  if (state.accumulator > 0.1) state.accumulator = 0.1;

  while (state.accumulator >= FIXED_DT) {
    stepOnce(
      state.positions, state.velocities,
      state.angularVelocities, state.orientations,
      spheres, ground, FIXED_DT
    );
    state.accumulator -= FIXED_DT;
  }

  // Return spheres with updated positions, velocities, and orientations
  return spheres.map((s, i) => ({
    ...s,
    center: [...state.positions[i]] as [number, number, number],
    velocity: [...state.velocities[i]] as [number, number, number],
    orientation: [...state.orientations[i]] as [number, number, number, number],
  }));
}
