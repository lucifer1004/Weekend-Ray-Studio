import type { CameraData } from '../gpu/raytracer';

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(dot(v, v));
  return len > 1e-8 ? scale(v, 1 / len) : [0, 0, 0];
}
function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

/** Convert camera origin to spherical coords relative to lookat */
function toSpherical(origin: Vec3, lookat: Vec3): { r: number; theta: number; phi: number } {
  const d = sub(origin, lookat);
  const r = length(d);
  const theta = Math.acos(Math.max(-1, Math.min(1, d[1] / r))); // polar angle from Y
  const phi = Math.atan2(d[2], d[0]); // azimuth
  return { r, theta, phi };
}

/** Convert spherical back to cartesian origin */
function fromSpherical(lookat: Vec3, r: number, theta: number, phi: number): Vec3 {
  return [
    lookat[0] + r * Math.sin(theta) * Math.cos(phi),
    lookat[1] + r * Math.cos(theta),
    lookat[2] + r * Math.sin(theta) * Math.sin(phi),
  ];
}

/** Orbit: rotate camera around lookat by pixel delta */
export function orbit(camera: CameraData, dx: number, dy: number, sensitivity = 0.005): CameraData {
  const { r, theta, phi } = toSpherical(camera.origin as Vec3, camera.lookat as Vec3);
  const newPhi = phi - dx * sensitivity;
  const newTheta = Math.max(0.05, Math.min(Math.PI - 0.05, theta - dy * sensitivity));
  const newOrigin = fromSpherical(camera.lookat as Vec3, r, newTheta, newPhi);
  return { ...camera, origin: newOrigin };
}

/** Zoom: move camera closer/further from lookat */
export function zoom(camera: CameraData, delta: number, sensitivity = 0.1): CameraData {
  const { r, theta, phi } = toSpherical(camera.origin as Vec3, camera.lookat as Vec3);
  const newR = Math.max(0.5, Math.min(100, r + delta * sensitivity));
  const newOrigin = fromSpherical(camera.lookat as Vec3, newR, theta, phi);
  return { ...camera, origin: newOrigin, focusDist: newR };
}

/** Pan: translate both origin and lookat along camera's local u/v axes */
export function pan(camera: CameraData, dx: number, dy: number, sensitivity = 0.02): CameraData {
  const w = normalize(sub(camera.origin as Vec3, camera.lookat as Vec3));
  const u = normalize(cross(camera.up as Vec3, w));
  const v = cross(w, u);

  const offset = add(scale(u, -dx * sensitivity), scale(v, dy * sensitivity));
  return {
    ...camera,
    origin: add(camera.origin as Vec3, offset),
    lookat: add(camera.lookat as Vec3, offset),
  };
}
