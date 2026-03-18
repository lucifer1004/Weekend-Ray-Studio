// Ray Tracing in One Weekend - WebGPU Compute Shader

struct Uniforms {
  width: u32,
  height: u32,
  samples_per_pixel: u32,
  frame_count: u32,
  cam_origin: vec3f,
  cam_lookat: vec3f,
  cam_up: vec3f,
  cam_vfov: f32,
  cam_defocus_angle: f32,
  cam_focus_dist: f32,
  sphere_count: u32,
  ground_tilt_x: f32,
  ground_tilt_z: f32,
  _pad1: f32,
  _pad2: f32,
}

struct Sphere {
  center: vec3f,
  radius: f32,
  color: vec3f,
  material_type: u32, // 0=lambertian, 1=metal, 2=dielectric
  fuzz_or_ior: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  orientation: vec4f, // quaternion (w, x, y, z)
}

// Ground plane constants
const GROUND_RADIUS_THRESHOLD: f32 = 100.0;
const GROUND_COLOR: vec3f = vec3f(0.5, 0.5, 0.5);

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<storage, read_write> accum: array<vec4f>;

var<private> rng_state: u32;

fn pcg_hash(input: u32) -> u32 {
  var state = input * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand() -> f32 {
  rng_state = pcg_hash(rng_state);
  return f32(rng_state) / 4294967296.0;
}

fn rand_in_unit_sphere() -> vec3f {
  loop {
    let p = vec3f(rand() * 2.0 - 1.0, rand() * 2.0 - 1.0, rand() * 2.0 - 1.0);
    if dot(p, p) < 1.0 {
      return p;
    }
  }
}

fn rand_unit_vector() -> vec3f {
  return normalize(rand_in_unit_sphere());
}

fn rand_in_unit_disk() -> vec2f {
  loop {
    let p = vec2f(rand() * 2.0 - 1.0, rand() * 2.0 - 1.0);
    if dot(p, p) < 1.0 {
      return p;
    }
  }
}

struct Ray {
  origin: vec3f,
  dir: vec3f,
}

fn ray_at(r: Ray, t: f32) -> vec3f {
  return r.origin + t * r.dir;
}

struct HitRecord {
  p: vec3f,
  normal: vec3f,
  t: f32,
  front_face: bool,
  sphere_idx: u32,
}

fn set_face_normal(r: Ray, outward_normal: vec3f, rec: ptr<function, HitRecord>) {
  (*rec).front_face = dot(r.dir, outward_normal) < 0.0;
  if (*rec).front_face {
    (*rec).normal = outward_normal;
  } else {
    (*rec).normal = -outward_normal;
  }
}

fn hit_sphere(s: Sphere, r: Ray, t_min: f32, t_max: f32, rec: ptr<function, HitRecord>) -> bool {
  let oc = s.center - r.origin;
  let a = dot(r.dir, r.dir);
  let h = dot(r.dir, oc);
  let c = dot(oc, oc) - s.radius * s.radius;
  let discriminant = h * h - a * c;
  if discriminant < 0.0 {
    return false;
  }
  let sqrtd = sqrt(discriminant);
  var root = (h - sqrtd) / a;
  if root <= t_min || t_max <= root {
    root = (h + sqrtd) / a;
    if root <= t_min || t_max <= root {
      return false;
    }
  }
  (*rec).t = root;
  (*rec).p = ray_at(r, root);
  let outward_normal = ((*rec).p - s.center) / s.radius;
  set_face_normal(r, outward_normal, rec);
  return true;
}

// Check hit with tilted infinite ground plane
// Returns t value if hit, -1 if no hit
fn hit_ground_plane(r: Ray, t_min: f32, t_max: f32) -> f32 {
  // Ground plane: y - x*sin(tiltZ) - z*sin(tiltX) = 0
  // Normal: n = normalize(-sin(tiltZ), 1, -sin(tiltX))
  let tiltX = uniforms.ground_tilt_x;
  let tiltZ = uniforms.ground_tilt_z;
  
  let nx = -sin(tiltZ);
  let ny = 1.0;
  let nz = -sin(tiltX);
  let normal_len = sqrt(nx*nx + ny*ny + nz*nz);
  let normal = vec3f(nx/normal_len, ny/normal_len, nz/normal_len);
  
  // Ray-plane intersection
  let denom = dot(r.dir, normal);
  if abs(denom) < 1e-6 {
    return -1.0; // Ray parallel to plane
  }
  
  // Plane passes through origin: dot(p, n) = 0
  let t = -dot(r.origin, normal) / denom;
  
  if t < t_min || t > t_max {
    return -1.0;
  }
  
  return t;
}

fn hit_world(r: Ray, t_min: f32, t_max: f32, rec: ptr<function, HitRecord>) -> bool {
  var hit_anything = false;
  var closest = t_max;
  
  // Check ground plane first (at y = 0, tilted)
  let ground_t = hit_ground_plane(r, t_min, closest);
  if ground_t > 0.0 {
    hit_anything = true;
    closest = ground_t;
    (*rec).t = ground_t;
    (*rec).p = ray_at(r, ground_t);
    (*rec).front_face = true;
    // Use ground plane normal
    let tiltX = uniforms.ground_tilt_x;
    let tiltZ = uniforms.ground_tilt_z;
    let nx = -sin(tiltZ);
    let ny = 1.0;
    let nz = -sin(tiltX);
    let len = sqrt(nx*nx + ny*ny + nz*nz);
    (*rec).normal = vec3f(nx/len, ny/len, nz/len);
    // Mark as ground hit (special sphere_idx)
    (*rec).sphere_idx = 0xffffffffu;
  }
  
  let count = uniforms.sphere_count;
  for (var i = 0u; i < count; i++) {
    // Skip large ground spheres - rendered as tilted plane instead
    if spheres[i].radius >= GROUND_RADIUS_THRESHOLD {
      continue;
    }
    var temp_rec: HitRecord;
    if hit_sphere(spheres[i], r, t_min, closest, &temp_rec) {
      hit_anything = true;
      closest = temp_rec.t;
      *rec = temp_rec;
      (*rec).sphere_idx = i;
    }
  }
  return hit_anything;
}

fn reflectance(cosine: f32, ior: f32) -> f32 {
  var r0 = (1.0 - ior) / (1.0 + ior);
  r0 = r0 * r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

// Rotate vector by inverse of quaternion q = (w, x, y, z)
fn quat_rotate_inv(q: vec4f, v: vec3f) -> vec3f {
  // Conjugate rotation: q* = (w, -x, -y, -z)
  let qv = vec3f(-q.y, -q.z, -q.w);
  let t = 2.0 * cross(qv, v);
  return v + q.x * t + cross(qv, t);
}

// UV grid lines on sphere surface using orientation
fn sphere_grid(s: Sphere, hit_point: vec3f) -> f32 {
  let local_dir = normalize(hit_point - s.center);
  let rotated = quat_rotate_inv(s.orientation, local_dir);
  let theta = acos(clamp(rotated.y, -1.0, 1.0));
  let phi = atan2(rotated.z, rotated.x) + 3.14159265;
  // 8 longitude lines, 4 latitude lines
  let line_width = 0.06;
  let u_frac = fract(phi * 4.0 / 3.14159265);
  let v_frac = fract(theta * 4.0 / 3.14159265);
  let on_u = f32(u_frac < line_width || u_frac > (1.0 - line_width));
  let on_v = f32(v_frac < line_width || v_frac > (1.0 - line_width));
  return max(on_u, on_v);
}

fn ray_color(initial_ray: Ray) -> vec3f {
  var r = initial_ray;
  var color = vec3f(1.0);
  
  for (var bounce = 0u; bounce < 12u; bounce++) {
    var rec: HitRecord;
    if !hit_world(r, 0.001, 1e30, &rec) {
      // Sky
      let unit_dir = normalize(r.dir);
      let a = 0.5 * (unit_dir.y + 1.0);
      let sky = (1.0 - a) * vec3f(1.0) + a * vec3f(0.5, 0.7, 1.0);
      return color * sky;
    }
    
    // Check if we hit the ground plane
    if rec.sphere_idx == 0xffffffffu {
      // Checkerboard pattern based on world-space xz coordinates
      let checker = floor(rec.p.x) + floor(rec.p.z);
      let is_even = (i32(checker) % 2 + 2) % 2; // safe modulo for negatives
      let ground_col = select(vec3f(0.9, 0.9, 0.9), vec3f(0.2, 0.2, 0.2), is_even == 0);

      var scatter_dir = rec.normal + rand_unit_vector();
      if length(scatter_dir) < 1e-8 {
        scatter_dir = rec.normal;
      }
      r = Ray(rec.p, scatter_dir);
      color = color * ground_col;
      continue;
    }
    
    let s = spheres[rec.sphere_idx];
    
    if s.material_type == 0u {
      // Lambertian with checkerboard
      let grid = sphere_grid(s, rec.p);
      let sphere_col = mix(s.color, s.color * 0.3, grid);
      var scatter_dir = rec.normal + rand_unit_vector();
      if length(scatter_dir) < 1e-8 {
        scatter_dir = rec.normal;
      }
      r = Ray(rec.p, scatter_dir);
      color *= sphere_col;
    } else if s.material_type == 1u {
      // Metal with checkerboard
      let grid = sphere_grid(s, rec.p);
      let sphere_col = mix(s.color, s.color * 0.3, grid);
      let reflected = reflect(normalize(r.dir), rec.normal);
      let scattered_dir = reflected + s.fuzz_or_ior * rand_in_unit_sphere();
      if dot(scattered_dir, rec.normal) <= 0.0 {
        return vec3f(0.0);
      }
      r = Ray(rec.p, scattered_dir);
      color *= sphere_col;
    } else {
      // Dielectric
      let ri = select(s.fuzz_or_ior, 1.0 / s.fuzz_or_ior, rec.front_face);
      let unit_dir = normalize(r.dir);
      let cos_theta = min(dot(-unit_dir, rec.normal), 1.0);
      let sin_theta = sqrt(1.0 - cos_theta * cos_theta);
      let cannot_refract = ri * sin_theta > 1.0;
      var direction: vec3f;
      if cannot_refract || reflectance(cos_theta, ri) > rand() {
        direction = reflect(unit_dir, rec.normal);
      } else {
        direction = refract(unit_dir, rec.normal, ri);
      }
      r = Ray(rec.p, direction);
      // Dielectrics don't attenuate
    }
  }
  return vec3f(0.0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if x >= uniforms.width || y >= uniforms.height {
    return;
  }
  
  let idx = y * uniforms.width + x;
  rng_state = idx * 1973u + uniforms.frame_count * 9277u + 26699u;
  
  // Camera setup
  let theta = uniforms.cam_vfov * 3.14159265 / 180.0;
  let h = tan(theta / 2.0);
  let aspect = f32(uniforms.width) / f32(uniforms.height);
  let viewport_height = 2.0 * h * uniforms.cam_focus_dist;
  let viewport_width = viewport_height * aspect;
  
  let w = normalize(uniforms.cam_origin - uniforms.cam_lookat);
  let u = normalize(cross(uniforms.cam_up, w));
  let v = cross(w, u);
  
  let viewport_u = viewport_width * u;
  let viewport_v = viewport_height * (-v);
  let pixel_delta_u = viewport_u / f32(uniforms.width);
  let pixel_delta_v = viewport_v / f32(uniforms.height);
  
  let viewport_upper_left = uniforms.cam_origin - uniforms.cam_focus_dist * w - viewport_u / 2.0 - viewport_v / 2.0;
  let pixel00_loc = viewport_upper_left + 0.5 * (pixel_delta_u + pixel_delta_v);
  
  let defocus_radius = uniforms.cam_focus_dist * tan((uniforms.cam_defocus_angle / 2.0) * 3.14159265 / 180.0);
  let defocus_disk_u = defocus_radius * u;
  let defocus_disk_v = defocus_radius * v;
  
  var pixel_color = vec3f(0.0);
  let spp = uniforms.samples_per_pixel;
  
  for (var s = 0u; s < spp; s++) {
    let offset_x = rand() - 0.5;
    let offset_y = rand() - 0.5;
    let pixel_sample = pixel00_loc + (f32(x) + offset_x) * pixel_delta_u + (f32(y) + offset_y) * pixel_delta_v;
    
    var ray_origin = uniforms.cam_origin;
    if uniforms.cam_defocus_angle > 0.0 {
      let rd = rand_in_unit_disk();
      ray_origin = uniforms.cam_origin + rd.x * defocus_disk_u + rd.y * defocus_disk_v;
    }
    let ray_dir = pixel_sample - ray_origin;
    let r = Ray(ray_origin, ray_dir);
    pixel_color += ray_color(r);
  }
  
  pixel_color /= f32(spp);
  
  // Progressive accumulation
  let prev = accum[idx];
  let frame = f32(uniforms.frame_count);
  let new_color = vec4f(
    (prev.x * frame + pixel_color.x) / (frame + 1.0),
    (prev.y * frame + pixel_color.y) / (frame + 1.0),
    (prev.z * frame + pixel_color.z) / (frame + 1.0),
    1.0
  );
  accum[idx] = new_color;
  
  // Gamma correction
  let r_out = u32(clamp(sqrt(new_color.x), 0.0, 0.999) * 256.0);
  let g_out = u32(clamp(sqrt(new_color.y), 0.0, 0.999) * 256.0);
  let b_out = u32(clamp(sqrt(new_color.z), 0.0, 0.999) * 256.0);
  
  output[idx] = (255u << 24u) | (b_out << 16u) | (g_out << 8u) | r_out;
}
