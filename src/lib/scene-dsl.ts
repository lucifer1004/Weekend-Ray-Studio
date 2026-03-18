import type { CameraData, SphereData } from '../gpu/raytracer';

export interface ParsedScene {
  spheres: SphereData[];
  camera: CameraData;
  errors: string[];
}

const DEFAULT_CAMERA: CameraData = {
  origin: [13, 2, 3],
  lookat: [0, 0, 0],
  up: [0, 1, 0],
  vfov: 20,
  defocusAngle: 0.6,
  focusDist: 10.0,
};

function parseArray(s: string): number[] | null {
  try {
    const arr = JSON.parse(s.replace(/\(/g, '[').replace(/\)/g, ']'));
    if (Array.isArray(arr) && arr.every((n) => typeof n === 'number')) return arr;
  } catch {
    /* ignore */
  }
  return null;
}

function parseProps(tagContent: string): Record<string, string> {
  const props: Record<string, string> = {};
  // Match prop="value" or prop={value}
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|{([^}]*)})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagContent)) !== null) {
    props[m[1]] = m[2] ?? m[3];
  }
  return props;
}

export function parseSceneDSL(code: string): ParsedScene {
  const errors: string[] = [];
  const spheres: SphereData[] = [];
  const camera = { ...DEFAULT_CAMERA };

  // Parse <Camera ... />
  const cameraRe = /<Camera\s+([^/]*?)\/>/gs;
  let cm: RegExpExecArray | null;
  while ((cm = cameraRe.exec(code)) !== null) {
    const props = parseProps(cm[1]);
    if (props.origin) {
      const v = parseArray(props.origin);
      if (v && v.length === 3) camera.origin = v as [number, number, number];
      else errors.push('Camera: invalid origin');
    }
    if (props.lookat) {
      const v = parseArray(props.lookat);
      if (v && v.length === 3) camera.lookat = v as [number, number, number];
      else errors.push('Camera: invalid lookat');
    }
    if (props.up) {
      const v = parseArray(props.up);
      if (v && v.length === 3) camera.up = v as [number, number, number];
    }
    if (props.vfov) camera.vfov = parseFloat(props.vfov) || 20;
    if (props.defocusAngle) camera.defocusAngle = parseFloat(props.defocusAngle) || 0;
    if (props.focusDist) camera.focusDist = parseFloat(props.focusDist) || 10;
  }

  // Parse <Sphere ... />
  const sphereRe = /<Sphere\s+([^/]*?)\/>/gs;
  let sm: RegExpExecArray | null;
  while ((sm = sphereRe.exec(code)) !== null) {
    const props = parseProps(sm[1]);
    const center = (parseArray(props.center || '[0,0,0]') as [number, number, number]) || [0, 0, 0];
    const radius = parseFloat(props.radius || '1') || 1;
    const color = (parseArray(props.color || '[0.5,0.5,0.5]') as [number, number, number]) || [
      0.5, 0.5, 0.5,
    ];

    let materialType = 0;
    let fuzzOrIor = 0;
    const mat = (props.material || 'lambertian').replace(/['"]/g, '');
    if (mat === 'metal') {
      materialType = 1;
      fuzzOrIor = parseFloat(props.fuzz || '0') || 0;
    } else if (mat === 'dielectric' || mat === 'glass') {
      materialType = 2;
      fuzzOrIor = parseFloat(props.ior || '1.5') || 1.5;
    }

    const velocity = (parseArray(props.velocity || '[0,0,0]') as [number, number, number]) || [
      0, 0, 0,
    ];
    const elasticity = parseFloat(props.elasticity || '0.8');

    spheres.push({ center, radius, color, materialType, fuzzOrIor, velocity, elasticity });
  }

  if (spheres.length === 0) {
    errors.push('No spheres found. Add <Sphere /> elements.');
  }

  // Check for overlapping spheres (skip ground planes with radius >= 100)
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const a = spheres[i],
        b = spheres[j];
      if (a.radius >= 100 || b.radius >= 100) continue;
      const dx = a.center[0] - b.center[0];
      const dy = a.center[1] - b.center[1];
      const dz = a.center[2] - b.center[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minDist = a.radius + b.radius;
      if (dist < minDist) {
        errors.push(
          `Sphere ${i + 1} and Sphere ${j + 1} overlap (distance ${dist.toFixed(2)} < ${minDist.toFixed(2)})`
        );
      }
    }
  }

  return { spheres, camera, errors };
}

export const DEFAULT_SCENE = `<Scene>
  {/* Camera */}
  <Camera
    origin={[13, 2, 3]}
    lookat={[0, 0, 0]}
    vfov={20}
    defocusAngle={0.6}
    focusDist={10.0}
  />

  {/* Ground */}
  <Sphere
    center={[0, -1000, 0]}
    radius={1000}
    material="lambertian"
    color={[0.5, 0.5, 0.5]}
  />

  {/* Glass ball */}
  <Sphere
    center={[0, 1, 0]}
    radius={1}
    material="dielectric"
    ior={1.5}
    velocity={[0, 5, 0]}
    elasticity={0.9}
  />

  {/* Matte ball */}
  <Sphere
    center={[-4, 1, 0]}
    radius={1}
    material="lambertian"
    color={[0.4, 0.2, 0.1]}
    velocity={[2, 3, 0]}
    elasticity={0.7}
  />

  {/* Metal ball */}
  <Sphere
    center={[4, 1, 0]}
    radius={1}
    material="metal"
    color={[0.7, 0.6, 0.5]}
    fuzz={0.0}
    velocity={[-1, 4, 1]}
    elasticity={0.85}
  />

  {/* Small spheres */}
  <Sphere center={[1, 0.3, -1]} radius={0.3} material="metal" color={[0.9, 0.2, 0.2]} fuzz={0.1} velocity={[0, 2, 0]} elasticity={0.8} />
  <Sphere center={[-1, 0.3, 1]} radius={0.3} material="lambertian" color={[0.2, 0.8, 0.2]} velocity={[1, 3, -1]} elasticity={0.75} />
  <Sphere center={[2, 0.25, 1.5]} radius={0.25} material="dielectric" ior={1.5} velocity={[-1, 1, 0]} elasticity={0.9} />
  <Sphere center={[-2, 0.35, -0.5]} radius={0.35} material="metal" color={[0.8, 0.8, 0.2]} fuzz={0.3} velocity={[0, 0, 2]} elasticity={0.6} />
  <Sphere center={[0.5, 0.2, 2]} radius={0.2} material="lambertian" color={[0.1, 0.3, 0.8]} velocity={[0, 6, 0]} elasticity={0.95} />
</Scene>
`;
