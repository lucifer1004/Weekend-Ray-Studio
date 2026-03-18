import { useCallback, useEffect, useRef, useState } from 'react';
import { type CameraData, RayTracer, type SphereData, type GroundData } from '../gpu/raytracer';
import { orbit, pan, zoom } from '../lib/camera-controls';
import {
  buildCameraBasis,
  computeDragPosition,
  getScreenRadius,
  hitTestSpheres,
  pixelToRay,
  projectToScreen,
} from '../lib/scene-math';

interface RayTracerCanvasProps {
  spheres: SphereData[];
  camera: CameraData;
  ground: GroundData;
  width?: number;
  height?: number;
  onSphereDragEnd?: (sphereIndex: number, newCenter: [number, number, number]) => void;
  selectedIndex?: number | null;
  onSelect?: (index: number | null) => void;
  onCameraChange?: (camera: CameraData) => void;
  isSimulating?: boolean;
  simSpheres?: SphereData[] | null;
}

interface DragState {
  sphereIndex: number;
  startPx: [number, number];
  currentPx: [number, number];
  currentCenter: [number, number, number];
}

export const RayTracerCanvas = ({
  spheres,
  camera,
  ground,
  width = 800,
  height = 450,
  onSphereDragEnd,
  selectedIndex,
  onSelect,
  onCameraChange,
  isSimulating,
  simSpheres,
}: RayTracerCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const tracerRef = useRef<RayTracer | null>(null);
  const animRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(0);
  const [status, setStatus] = useState<string>('Initializing WebGPU...');
  const [displayFrame, setDisplayFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [supported, setSupported] = useState(true);
  const [ready, setReady] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cameraAction, setCameraAction] = useState<{
    type: 'orbit' | 'pan';
    startX: number;
    startY: number;
    startCamera: CameraData;
  } | null>(null);

  const spheresRef = useRef(spheres);
  const cameraRef = useRef(camera);
  const groundRef = useRef(ground);
  spheresRef.current = spheres;
  cameraRef.current = camera;
  groundRef.current = ground;

  // Init WebGPU
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const tracer = new RayTracer(width, height);
      const ok = await tracer.init();
      if (cancelled) {
        tracer.destroy();
        return;
      }
      if (!ok) {
        setSupported(false);
        setStatus('WebGPU not supported');
        return;
      }
      tracerRef.current = tracer;
      setStatus('Ready');
      setReady(true);
    };
    init();
    return () => {
      cancelled = true;
      tracerRef.current?.destroy();
      tracerRef.current = null;
    };
  }, [width, height]);

  const isSimulatingRef = useRef(isSimulating);
  isSimulatingRef.current = isSimulating;

  // Track scene version to know when to reset accumulation
  const sceneVersionRef = useRef(0);
  useEffect(() => {
    sceneVersionRef.current++;
  }, [spheres, camera, ground]);

  // Always reset accumulation when simulation state changes
  useEffect(() => {
    sceneVersionRef.current++;
  }, []);

  // Render loop - stays alive so simulation and scene edits can restart rendering
  useEffect(() => {
    if (!tracerRef.current || !ready) return;
    tracerRef.current.resetAccumulation();
    frameCountRef.current = 0;
    startTimeRef.current = performance.now();
    setDisplayFrame(0);
    setElapsed(0);

    let running = true;
    let lastVersion = sceneVersionRef.current;

    const loop = async () => {
      const tracer = tracerRef.current;
      const canvas = canvasRef.current;
      if (!tracer || !canvas || !running) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const simming = isSimulatingRef.current;
      const curVersion = sceneVersionRef.current;
      const sceneChanged = curVersion !== lastVersion;
      const shouldRender = simming || sceneChanged || frameCountRef.current < 500;

      if (sceneChanged) {
        tracer.resetAccumulation();
        frameCountRef.current = 0;
        startTimeRef.current = performance.now();
        setDisplayFrame(0);
        setElapsed(0);
        lastVersion = curVersion;
      }

      if (!shouldRender) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        const data = await tracer.render(spheresRef.current, cameraRef.current, groundRef.current);
        const imageData = new ImageData(
          new Uint8ClampedArray(data.buffer as ArrayBuffer),
          width,
          height
        );
        ctx.putImageData(imageData, 0, 0);
        frameCountRef.current++;
        const secs = ((performance.now() - startTimeRef.current) / 1000).toFixed(1);
        setDisplayFrame(frameCountRef.current);
        setElapsed(parseFloat(secs));

        if (simming) {
          tracer.resetAccumulation();
          frameCountRef.current = 0;
          setStatus('Live preview');
        } else {
          setStatus(
            frameCountRef.current >= 500
              ? `Complete in ${secs}s`
              : `Rendering... Frame ${frameCountRef.current}`
          );
        }
      } catch (e) {
        console.error('Render error:', e);
        setStatus('Render error');
      }

      if (running) {
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [width, height, ready]);

  // Draw overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const cam = buildCameraBasis(camera, width, height);

    // Draw camera orientation gizmo (Blender-style axis indicator)
    const drawCameraGizmo = () => {
      const gizmoSize = 50;
      const padding = 15;
      const originX = padding + gizmoSize / 2;
      const originY = height - padding - gizmoSize / 2;
      const scale = gizmoSize / 4;

      // Helper functions
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const normalizeVec = (v: number[]): number[] => {
        const len = Math.sqrt(dot(v, v));
        return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
      };
      const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const cross = (a: number[], b: number[]) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];

      // Camera position relative to lookat
      const camPos = [camera.origin[0], camera.origin[1], camera.origin[2]];
      const lookAt = [camera.lookat[0], camera.lookat[1], camera.lookat[2]];

      // Compute camera axes
      const w = normalizeVec(sub(camPos, lookAt));
      const up = normalizeVec([camera.up[0], camera.up[1], camera.up[2]]);
      const u = normalizeVec(cross(up, w));
      const v = normalizeVec(cross(w, u));

      // Draw background circle
      ctx.beginPath();
      ctx.arc(originX, originY, gizmoSize / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      // Helper to project 3D point to 2D (relative to origin)
      const project = (p: number[]) => {
        return [
          originX + (p[0] * u[0] + p[1] * v[0] + p[2] * w[0]) * scale,
          originY - (p[0] * u[1] + p[1] * v[1] + p[2] * w[1]) * scale,
        ] as [number, number];
      };

      // Draw axis lines
      const axisLength = 1.5;

      // X axis (red) - right in camera space
      const xEnd = project([axisLength, 0, 0]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(xEnd[0], xEnd[1]);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('X', xEnd[0] + 5, xEnd[1] + 3);

      // Y axis (green) - up in camera space
      const yEnd = project([0, axisLength, 0]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(yEnd[0], yEnd[1]);
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('Y', yEnd[0] + 3, yEnd[1] - 3);

      // Z axis (blue) - forward in camera space
      const zEnd = project([0, 0, axisLength]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(zEnd[0], zEnd[1]);
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3498db';
      ctx.fillText('Z', zEnd[0] + 3, zEnd[1] + 12);

      // Draw origin dot
      ctx.beginPath();
      ctx.arc(originX, originY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };

    drawCameraGizmo();

    const drawSphereHighlight = (
      sphere: { center: [number, number, number]; radius: number },
      mode: 'selected' | 'hover' | 'drag'
    ) => {
      if (sphere.radius >= 100) return;
      const screenPos = projectToScreen(cam, sphere.center, width, height);
      const screenR = getScreenRadius(cam, sphere as SphereData, width, height);
      if (!screenPos || !screenR) return;

      const [cx, cy] = screenPos;

      if (mode === 'drag') {
        // Soft glow ring + fill
        const gradient = ctx.createRadialGradient(cx, cy, screenR * 0.8, cx, cy, screenR * 1.4);
        gradient.addColorStop(0, 'rgba(118, 185, 0, 0.0)');
        gradient.addColorStop(0.6, 'rgba(118, 185, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(118, 185, 0, 0.0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - screenR * 1.5, cy - screenR * 1.5, screenR * 3, screenR * 3);

        // Solid thin ring
        ctx.strokeStyle = 'rgba(118, 185, 0, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
        ctx.stroke();

        // Position label with rounded bg
        const label = `(${sphere.center[0].toFixed(1)}, ${sphere.center[1].toFixed(1)}, ${sphere.center[2].toFixed(1)})`;
        ctx.font = '10px ui-monospace, monospace';
        const metrics = ctx.measureText(label);
        const lw = metrics.width + 10;
        const lh = 18;
        const lx = cx - lw / 2;
        const ly = cy - screenR - 24;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, 4);
        ctx.fill();
        ctx.fillStyle = '#76b900';
        ctx.fillText(label, lx + 5, ly + 13);
      } else if (mode === 'selected') {
        // Outer soft glow
        const gradient = ctx.createRadialGradient(cx, cy, screenR * 0.7, cx, cy, screenR * 1.6);
        gradient.addColorStop(0, 'rgba(118, 185, 0, 0.0)');
        gradient.addColorStop(0.5, 'rgba(118, 185, 0, 0.08)');
        gradient.addColorStop(0.8, 'rgba(118, 185, 0, 0.12)');
        gradient.addColorStop(1, 'rgba(118, 185, 0, 0.0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - screenR * 2, cy - screenR * 2, screenR * 4, screenR * 4);

        // Two-tone ring: outer subtle, inner bright
        ctx.strokeStyle = 'rgba(118, 185, 0, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, screenR + 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(118, 185, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
        ctx.stroke();

        // Small corner ticks (crosshair-like)
        const tickLen = Math.min(8, screenR * 0.3);
        const tickOff = screenR + 6;
        ctx.strokeStyle = 'rgba(118, 185, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // top
        ctx.moveTo(cx, cy - tickOff);
        ctx.lineTo(cx, cy - tickOff + tickLen);
        // bottom
        ctx.moveTo(cx, cy + tickOff);
        ctx.lineTo(cx, cy + tickOff - tickLen);
        // left
        ctx.moveTo(cx - tickOff, cy);
        ctx.lineTo(cx - tickOff + tickLen, cy);
        // right
        ctx.moveTo(cx + tickOff, cy);
        ctx.lineTo(cx + tickOff - tickLen, cy);
        ctx.stroke();
      } else {
        // Hover: very subtle glow
        const gradient = ctx.createRadialGradient(cx, cy, screenR * 0.8, cx, cy, screenR * 1.3);
        gradient.addColorStop(0, 'rgba(118, 185, 0, 0.0)');
        gradient.addColorStop(0.7, 'rgba(118, 185, 0, 0.06)');
        gradient.addColorStop(1, 'rgba(118, 185, 0, 0.0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - screenR * 1.5, cy - screenR * 1.5, screenR * 3, screenR * 3);

        ctx.strokeStyle = 'rgba(118, 185, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // Draw the appropriate highlight
    if (dragState) {
      const sphere = { ...spheres[dragState.sphereIndex], center: dragState.currentCenter };
      drawSphereHighlight(sphere, 'drag');

      // Ghost of original position
      const orig = spheres[dragState.sphereIndex];
      const origPos = projectToScreen(cam, orig.center as [number, number, number], width, height);
      const origR = getScreenRadius(cam, orig, width, height);
      if (origPos && origR) {
        ctx.strokeStyle = 'rgba(118, 185, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(origPos[0], origPos[1], origR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < spheres.length) {
      drawSphereHighlight(
        spheres[hoveredIndex],
        selectedIndex === hoveredIndex ? 'selected' : 'hover'
      );
    } else if (
      selectedIndex !== null &&
      selectedIndex !== undefined &&
      selectedIndex >= 0 &&
      selectedIndex < spheres.length
    ) {
      drawSphereHighlight(spheres[selectedIndex], 'selected');
    }
  }, [dragState, hoveredIndex, selectedIndex, spheres, camera, width, height]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    },
    [width, height]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Right-click or middle-click: camera controls
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        const actionType = e.shiftKey ? 'pan' : 'orbit';
        setCameraAction({
          type: actionType,
          startX: e.clientX,
          startY: e.clientY,
          startCamera: { ...camera },
        });
        return;
      }
      if (e.button !== 0) return;
      // Disable dragging while simulation is actively running
      if (isSimulating) return;
      const [px, py] = getCanvasCoords(e);
      const cam = buildCameraBasis(camera, width, height);
      const ray = pixelToRay(cam, px, py);
      const hitIdx = hitTestSpheres(spheres, ray.origin, ray.dir);

      if (hitIdx >= 0) {
        onSelect?.(hitIdx);
        setDragState({
          sphereIndex: hitIdx,
          startPx: [px, py],
          currentPx: [px, py],
          currentCenter: [...spheres[hitIdx].center],
        });
        e.preventDefault();
      } else {
        onSelect?.(null);
      }
    },
    [spheres, camera, width, height, getCanvasCoords, onSelect, isSimulating]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (cameraAction) {
        const dx = e.clientX - cameraAction.startX;
        const dy = e.clientY - cameraAction.startY;
        let newCam: CameraData;
        if (cameraAction.type === 'pan') {
          newCam = pan(cameraAction.startCamera, dx, dy);
        } else {
          newCam = orbit(cameraAction.startCamera, dx, dy);
        }
        onCameraChange?.(newCam);
        return;
      }

      const [px, py] = getCanvasCoords(e);

      if (dragState) {
        const cam = buildCameraBasis(camera, width, height);
        const newCenter = computeDragPosition(
          cam,
          spheres[dragState.sphereIndex],
          dragState.startPx,
          [px, py],
          e.shiftKey
        );
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentPx: [px, py],
                currentCenter: newCenter as [number, number, number],
              }
            : null
        );
      } else {
        const cam = buildCameraBasis(camera, width, height);
        const ray = pixelToRay(cam, px, py);
        const hitIdx = hitTestSpheres(spheres, ray.origin, ray.dir);
        setHoveredIndex(hitIdx >= 0 ? hitIdx : null);
      }
    },
    [cameraAction, dragState, spheres, camera, width, height, getCanvasCoords, onCameraChange]
  );

  const handleMouseUp = useCallback(() => {
    if (cameraAction) {
      setCameraAction(null);
      return;
    }
    if (dragState) {
      onSphereDragEnd?.(dragState.sphereIndex, dragState.currentCenter);
      setDragState(null);
    }
  }, [cameraAction, dragState, onSphereDragEnd]);

  const handleMouseLeave = useCallback(() => {
    if (cameraAction) {
      setCameraAction(null);
      return;
    }
    if (dragState) {
      onSphereDragEnd?.(dragState.sphereIndex, dragState.currentCenter);
      setDragState(null);
    }
    setHoveredIndex(null);
  }, [dragState, onSphereDragEnd, cameraAction]);

  // Attach wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const newCam = zoom(camera, e.deltaY > 0 ? 1 : -1);
      onCameraChange?.(newCam);
    };

    const overlay = overlayRef.current;
    const target = overlay ?? canvas;
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => target.removeEventListener('wheel', onWheel);
  }, [camera, onCameraChange]);

  if (!supported) {
    return (
      <div
        className="flex items-center justify-center bg-[var(--background-color-surface-raised)] rounded-lg p-8"
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="text-[var(--text-color-primary)] text-lg font-semibold mb-2">
            WebGPU Not Supported
          </p>
          <p className="text-[var(--text-color-secondary)] text-sm">
            Please use Chrome 113+ or Edge 113+ with WebGPU enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative rounded-lg border border-[var(--border-color-base)]"
        style={{ width, height }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width, height, imageRendering: 'auto' }}
        />
        <canvas
          ref={overlayRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{
            width,
            height,
            cursor: cameraAction
              ? cameraAction.type === 'pan'
                ? 'move'
                : 'grabbing'
              : dragState
                ? 'grabbing'
                : hoveredIndex !== null
                  ? 'grab'
                  : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--text-color-secondary)] px-1">
        <span>{status}</span>
        <span>
          {spheres.length} objects • {displayFrame} samples • {elapsed}s
          {dragState && ' • Dragging...'}
        </span>
      </div>
    </div>
  );
};
