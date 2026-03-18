import type { CameraData, SphereData } from '../gpu/raytracer';

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
  return len > 0 ? scale(v, 1 / len) : [0, 0, 0];
}
function _length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

interface CameraBasis {
  origin: Vec3;
  pixel00_loc: Vec3;
  pixel_delta_u: Vec3;
  pixel_delta_v: Vec3;
  w: Vec3; // view direction (toward camera from lookat)
}

export function buildCameraBasis(camera: CameraData, width: number, height: number): CameraBasis {
  const origin = camera.origin as Vec3;
  const lookat = camera.lookat as Vec3;
  const up = camera.up as Vec3;

  const theta = (camera.vfov * Math.PI) / 180;
  const h = Math.tan(theta / 2);
  const aspect = width / height;
  const focusDist = camera.focusDist;
  const viewport_height = 2 * h * focusDist;
  const viewport_width = viewport_height * aspect;

  const w = normalize(sub(origin, lookat));
  const u = normalize(cross(up, w));
  const v = cross(w, u);

  const viewport_u = scale(u, viewport_width);
  const viewport_v = scale(v, -viewport_height);
  const pixel_delta_u = scale(viewport_u, 1 / width);
  const pixel_delta_v = scale(viewport_v, 1 / height);

  const viewport_upper_left = sub(
    sub(sub(origin, scale(w, focusDist)), scale(viewport_u, 0.5)),
    scale(viewport_v, 0.5)
  );
  const pixel00_loc = add(viewport_upper_left, scale(add(pixel_delta_u, pixel_delta_v), 0.5));

  return { origin, pixel00_loc, pixel_delta_u, pixel_delta_v, w };
}

export function pixelToRay(cam: CameraBasis, px: number, py: number): { origin: Vec3; dir: Vec3 } {
  const target = add(
    cam.pixel00_loc,
    add(scale(cam.pixel_delta_u, px), scale(cam.pixel_delta_v, py))
  );
  return { origin: cam.origin, dir: normalize(sub(target, cam.origin)) };
}

/** Returns index of hit sphere, or -1. Skips ground (radius >= 100). */
export function hitTestSpheres(spheres: SphereData[], rayOrigin: Vec3, rayDir: Vec3): number {
  let closestT = 1e30;
  let closestIdx = -1;

  for (let i = 0; i < spheres.length; i++) {
    if (spheres[i].radius >= 100) continue; // skip ground
    const center = spheres[i].center as Vec3;
    const radius = spheres[i].radius;
    const oc = sub(center, rayOrigin);
    const a = dot(rayDir, rayDir);
    const h_val = dot(rayDir, oc);
    const c = dot(oc, oc) - radius * radius;
    const disc = h_val * h_val - a * c;
    if (disc < 0) continue;
    const sqrtd = Math.sqrt(disc);
    let t = (h_val - sqrtd) / a;
    if (t <= 0.001) {
      t = (h_val + sqrtd) / a;
      if (t <= 0.001) continue;
    }
    if (t < closestT) {
      closestT = t;
      closestIdx = i;
    }
  }
  return closestIdx;
}

/** Intersect ray with a plane defined by point and normal. Returns t or null. */
function rayPlaneIntersect(
  rayOrigin: Vec3,
  rayDir: Vec3,
  planePoint: Vec3,
  planeNormal: Vec3
): number | null {
  const denom = dot(planeNormal, rayDir);
  if (Math.abs(denom) < 1e-8) return null;
  const t = dot(sub(planePoint, rayOrigin), planeNormal) / denom;
  return t > 0 ? t : null;
}

/** Given a drag from one pixel to another, compute the new sphere center on the drag plane. */
export function computeDragPosition(
  cam: CameraBasis,
  sphere: SphereData,
  startPx: [number, number],
  currentPx: [number, number],
  constrainY: boolean
): Vec3 {
  const center = sphere.center as Vec3;
  // Drag plane: through sphere center, perpendicular to camera view
  const planeNormal = normalize(scale(cam.w, -1)); // toward camera

  const startRay = pixelToRay(cam, startPx[0], startPx[1]);
  const currentRay = pixelToRay(cam, currentPx[0], currentPx[1]);

  const t0 = rayPlaneIntersect(startRay.origin, startRay.dir, center, planeNormal);
  const t1 = rayPlaneIntersect(currentRay.origin, currentRay.dir, center, planeNormal);

  if (t0 === null || t1 === null) return center;

  const p0 = add(startRay.origin, scale(startRay.dir, t0));
  const p1 = add(currentRay.origin, scale(currentRay.dir, t1));
  const delta = sub(p1, p0);

  const newCenter: Vec3 = add(center, delta);
  if (constrainY) {
    newCenter[1] = center[1]; // lock Y axis
  }
  return newCenter;
}

/** Project a 3D point to pixel coordinates. Returns [px, py] or null if behind camera. */
export function projectToScreen(
  cam: CameraBasis,
  point: Vec3,
  width: number,
  height: number
): [number, number] | null {
  const w = cam.w;
  const _u = normalize(cross(cam.pixel_delta_v, cam.pixel_delta_u)); // won't work, compute from w
  // Re-derive u, v from w
  // Actually, let's use a proper inverse projection
  const toPoint = sub(point, cam.origin);
  const distAlongW = -dot(toPoint, w); // negative because w points away from lookat
  if (distAlongW <= 0) return null;

  // pixel_delta_u and pixel_delta_v define the mapping
  // point = pixel00_loc + px * pixel_delta_u + py * pixel_delta_v (approximately)
  // So we solve for px, py
  const _fromPixel00 = sub(point, cam.pixel00_loc);

  // Project onto the plane at the point's depth
  // Scale factor: the pixel deltas are at focusDist, but point may be at different depth
  // Actually pixel_delta_u/v are per-pixel at focus distance. For arbitrary depth:
  // We need to find where the ray through the point hits the pixel grid.
  // ray: origin + t * dir = point => dir = (point - origin) / t
  // Then px = dot(dir_on_plane, u_dir) / |pixel_delta_u|^2...

  // Simpler: cast ray from origin through point, find pixel
  const dir = normalize(toPoint);
  // We know pixel00_loc + px * pdu + py * pdv is on the focal plane
  // Ray hits focal plane at t where dot(origin + t*dir - origin, -w) = focusDist (w points away)
  // => t * dot(dir, -w) = dot(pixel00_loc - origin, -w) ...
  // Actually: focal plane contains pixel00_loc, normal is -w
  const focalT = rayPlaneIntersect(cam.origin, dir, cam.pixel00_loc, normalize(scale(w, -1)));
  if (focalT === null) return null;

  const hitOnFocalPlane = add(cam.origin, scale(dir, focalT));
  const fromP00 = sub(hitOnFocalPlane, cam.pixel00_loc);

  // pixel_delta_u and pixel_delta_v form a basis on the focal plane
  const pduLen2 = dot(cam.pixel_delta_u, cam.pixel_delta_u);
  const pdvLen2 = dot(cam.pixel_delta_v, cam.pixel_delta_v);
  const px = dot(fromP00, cam.pixel_delta_u) / pduLen2;
  const py = dot(fromP00, cam.pixel_delta_v) / pdvLen2;

  if (px < -50 || px > width + 50 || py < -50 || py > height + 50) return null;
  return [px, py];
}

/** Get the apparent screen radius of a sphere. */
export function getScreenRadius(
  cam: CameraBasis,
  sphere: SphereData,
  width: number,
  height: number
): number | null {
  const center = sphere.center as Vec3;
  const centerScreen = projectToScreen(cam, center, width, height);
  if (!centerScreen) return null;

  // Project a point on the sphere's edge (perpendicular to view)
  const viewDir = normalize(scale(cam.w, -1));
  // Get a vector perpendicular to view direction
  const arbitrary: Vec3 = Math.abs(viewDir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const perp = normalize(cross(viewDir, arbitrary));
  const edgePoint = add(center, scale(perp, sphere.radius));
  const edgeScreen = projectToScreen(cam, edgePoint, width, height);
  if (!edgeScreen) return null;

  const dx = edgeScreen[0] - centerScreen[0];
  const dy = edgeScreen[1] - centerScreen[1];
  return Math.sqrt(dx * dx + dy * dy);
}
