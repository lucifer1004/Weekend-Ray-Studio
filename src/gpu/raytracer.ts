/// <reference types="@webgpu/types" />
import shaderCode from './shaders.wgsl?raw';

export interface SphereData {
  center: [number, number, number];
  radius: number;
  color: [number, number, number];
  materialType: number; // 0=lambertian, 1=metal, 2=dielectric
  fuzzOrIor: number;
  velocity: [number, number, number];
  elasticity: number;
}

export interface CameraData {
  origin: [number, number, number];
  lookat: [number, number, number];
  up: [number, number, number];
  vfov: number;
  defocusAngle: number;
  focusDist: number;
}

export class RayTracer {
  private device!: GPUDevice;
  private pipeline!: GPUComputePipeline;
  private outputBuffer!: GPUBuffer;
  private accumBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private sphereBuffer!: GPUBuffer;
  private readBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private width: number;
  private height: number;
  private frameCount = 0;
  private samplesPerFrame = 4;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  async init(): Promise<boolean> {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    this.device = await adapter.requestDevice();

    const module = this.device.createShaderModule({ code: shaderCode });

    this.pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });

    this.createBuffers();
    return true;
  }

  private createBuffers() {
    const pixelCount = this.width * this.height;

    this.uniformBuffer = this.device.createBuffer({
      size: 256, // padded
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sphereBuffer = this.device.createBuffer({
      size: Math.max(48 * 256, 48), // max 256 spheres, 48 bytes each
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.outputBuffer = this.device.createBuffer({
      size: pixelCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    this.accumBuffer = this.device.createBuffer({
      size: pixelCount * 16,
      usage: GPUBufferUsage.STORAGE,
    });

    this.readBuffer = this.device.createBuffer({
      size: pixelCount * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.sphereBuffer } },
        { binding: 2, resource: { buffer: this.outputBuffer } },
        { binding: 3, resource: { buffer: this.accumBuffer } },
      ],
    });
  }

  resetAccumulation() {
    this.frameCount = 0;
    // Recreate accum buffer and zero it
    this.accumBuffer.destroy();
    this.accumBuffer = this.device.createBuffer({
      size: this.width * this.height * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // Zero the new buffer explicitly
    const zeroData = new Uint8Array(this.width * this.height * 16);
    this.device.queue.writeBuffer(this.accumBuffer, 0, zeroData);
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.sphereBuffer } },
        { binding: 2, resource: { buffer: this.outputBuffer } },
        { binding: 3, resource: { buffer: this.accumBuffer } },
      ],
    });
  }

  async render(spheres: SphereData[], camera: CameraData): Promise<Uint8ClampedArray> {
    // Upload uniforms
    const uniforms = new ArrayBuffer(256);
    const u32 = new Uint32Array(uniforms);
    const f32 = new Float32Array(uniforms);

    u32[0] = this.width;
    u32[1] = this.height;
    u32[2] = this.samplesPerFrame;
    u32[3] = this.frameCount;
    // cam_origin at offset 16 (vec3f needs 16-byte alignment)
    f32[4] = camera.origin[0];
    f32[5] = camera.origin[1];
    f32[6] = camera.origin[2];
    // padding at f32[7]
    // cam_lookat at offset 32
    f32[8] = camera.lookat[0];
    f32[9] = camera.lookat[1];
    f32[10] = camera.lookat[2];
    // padding at f32[11]
    // cam_up at offset 48
    f32[12] = camera.up[0];
    f32[13] = camera.up[1];
    f32[14] = camera.up[2];
    // cam_vfov at offset 60
    f32[15] = camera.vfov;
    // cam_defocus_angle at offset 64
    f32[16] = camera.defocusAngle;
    // cam_focus_dist at offset 68
    f32[17] = camera.focusDist;
    // sphere_count at offset 72
    u32[18] = spheres.length;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    // Upload spheres (48 bytes each: 3f center + 1f radius + 3f color + 1u material + 1f fuzz + 3f padding)
    const sphereData = new ArrayBuffer(48 * Math.max(spheres.length, 1));
    const sf = new Float32Array(sphereData);
    const su = new Uint32Array(sphereData);

    for (let i = 0; i < spheres.length; i++) {
      const base = i * 12; // 48 bytes / 4 = 12 floats
      sf[base + 0] = spheres[i].center[0];
      sf[base + 1] = spheres[i].center[1];
      sf[base + 2] = spheres[i].center[2];
      sf[base + 3] = spheres[i].radius;
      sf[base + 4] = spheres[i].color[0];
      sf[base + 5] = spheres[i].color[1];
      sf[base + 6] = spheres[i].color[2];
      su[base + 7] = spheres[i].materialType;
      sf[base + 8] = spheres[i].fuzzOrIor;
      sf[base + 9] = 0; // pad
      sf[base + 10] = 0;
      sf[base + 11] = 0;
    }
    this.device.queue.writeBuffer(this.sphereBuffer, 0, sphereData);

    // Dispatch
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
    pass.end();

    encoder.copyBufferToBuffer(
      this.outputBuffer,
      0,
      this.readBuffer,
      0,
      this.width * this.height * 4
    );
    this.device.queue.submit([encoder.finish()]);

    await this.readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8ClampedArray(this.readBuffer.getMappedRange().slice(0));
    this.readBuffer.unmap();

    this.frameCount++;
    return data;
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.sphereBuffer?.destroy();
    this.outputBuffer?.destroy();
    this.accumBuffer?.destroy();
    this.readBuffer?.destroy();
  }
}
