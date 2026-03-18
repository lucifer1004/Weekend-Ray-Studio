import { Text } from '@nvidia/foundations-react-core';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ObjectControls } from '../components/ObjectControls';
import { RayTracerCanvas } from '../components/RayTracerCanvas';
import { SceneEditor } from '../components/SceneEditor';
import type { CameraData, SphereData } from '../gpu/raytracer';
import { createPhysicsState, type PhysicsState, stepPhysics } from '../lib/physics';
import { DEFAULT_SCENE, parseSceneDSL } from '../lib/scene-dsl';

function useDraggableDivider(initialWidth: number, minWidth: number, maxWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startW = width;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX;
        setWidth(Math.max(minWidth, Math.min(maxWidth, startW + delta)));
      };
      const onUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, minWidth, maxWidth]
  );

  return { width, onMouseDown };
}

const DragHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div
    onMouseDown={onMouseDown}
    className="w-[5px] cursor-col-resize hover:bg-[var(--color-brand)] active:bg-[var(--color-brand)] transition-colors flex-shrink-0"
    style={{ background: 'var(--border-color-base)' }}
    title="Drag to resize"
  />
);

const Index = () => {
  const [code, setCode] = useState(DEFAULT_SCENE);
  const [debouncedCode, setDebouncedCode] = useState(DEFAULT_SCENE);
  const codeRef = useRef(DEFAULT_SCENE); // Always access latest code without closure issues
  codeRef.current = code;
  const originalCodeRef = useRef(DEFAULT_SCENE); // Store original for reset
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const editorRef = useRef<{ scrollToTag: (index: number) => void }>(null);

  // Physics state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpheres, setSimSpheres] = useState<SphereData[] | null>(null);
  const physicsRef = useRef<PhysicsState | null>(null);
  const lastTimeRef = useRef(0);
  const simAnimRef = useRef(0);

  // Camera override (for interactive camera controls)
  const [cameraOverride, setCameraOverride] = useState<CameraData | null>(null);

  const panel1 = useDraggableDivider(260, 180, 400);
  const panel2 = useDraggableDivider(400, 250, 700);

  // Find line number for sphere/camera in DSL
  const scrollToEditor = useCallback((index: number) => {
    const currentCode = codeRef.current;
    const re = index === -1 ? /<Camera\s[^/]*?\/>/gs : /<Sphere\s[^/]*?\/>/gs;
    let count = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(currentCode)) !== null) {
      if (count === index) {
        // Count newlines to get line number
        const lineNumber = currentCode.slice(0, match.index).split('\n').length;
        editorRef.current?.scrollToTag(lineNumber);
        return;
      }
      count++;
    }
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    const timer = setTimeout(() => setDebouncedCode(value), 600);
    return () => clearTimeout(timer);
  }, []);

  const scene = useMemo(() => parseSceneDSL(debouncedCode), [debouncedCode]);

  // Use camera override if set, otherwise from DSL
  const activeCamera = cameraOverride ?? scene.camera;
  // Use simulated spheres if running, otherwise from DSL
  const activeSpheres = simSpheres ?? scene.spheres;

  const handleSphereDragEnd = useCallback(
    (sphereIndex: number, newCenter: [number, number, number]) => {
      const currentCode = codeRef.current;
      const re = /<Sphere\s[^/]*?\/>/gs;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = re.exec(currentCode)) !== null) {
        if (count === sphereIndex) {
          const tagStr = currentCode.slice(m.index, m.index + m[0].length);
          const centerStr = `[${newCenter.map((n) => parseFloat(n.toFixed(1))).join(', ')}]`;
          const propRe = /(center)\s*=\s*(?:"[^"]*"|{[^}]*})/;
          let updated: string;
          if (propRe.test(tagStr)) {
            updated = tagStr.replace(propRe, `center={${centerStr}}`);
          } else {
            updated = tagStr.replace(/\s*\/>/, `\n    center={${centerStr}}\n  />`);
          }
          const newCode =
            currentCode.slice(0, m.index) + updated + currentCode.slice(m.index + m[0].length);
          // Update immediately without debounce for drag
          setCode(newCode);
          setDebouncedCode(newCode);
          return;
        }
        count++;
      }
    },
    []
  );

  // Camera change from canvas interaction
  const handleCameraChange = useCallback((newCam: CameraData) => {
    setCameraOverride(newCam);
    // Also update DSL
    const currentCode = codeRef.current;
    const re = /<Camera\s[^/]*?\/>/gs;
    const m = re.exec(currentCode);
    if (m) {
      let tagStr = m[0];
      const updateProp = (tag: string, prop: string, val: string) => {
        const propRe = new RegExp(`(${prop})\\s*=\\s*(?:"[^"]*"|{[^}]*})`);
        if (propRe.test(tag)) return tag.replace(propRe, `${prop}={${val}}`);
        return tag.replace(/\s*\/>/, `\n    ${prop}={${val}}\n  />`);
      };
      tagStr = updateProp(
        tagStr,
        'origin',
        `[${newCam.origin.map((n) => parseFloat(n.toFixed(2))).join(', ')}]`
      );
      tagStr = updateProp(
        tagStr,
        'lookat',
        `[${newCam.lookat.map((n) => parseFloat(n.toFixed(2))).join(', ')}]`
      );
      tagStr = updateProp(tagStr, 'focusDist', parseFloat(newCam.focusDist.toFixed(2)).toString());
      const newCode =
        currentCode.slice(0, m.index) + tagStr + currentCode.slice(m.index + m[0].length);
      setCode(newCode);
      setDebouncedCode(newCode);
    }
  }, []);

  // Physics simulation loop
  const startSimulation = useCallback(() => {
    // Use current simulated positions if available, otherwise use original DSL positions
    const startingSpheres = simSpheres ?? scene.spheres;
    physicsRef.current = createPhysicsState(startingSpheres);
    lastTimeRef.current = performance.now();
    setIsSimulating(true);
  }, [scene.spheres, simSpheres]);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    cancelAnimationFrame(simAnimRef.current);
    // Keep simSpheres so paused state stays visible
  }, []);

  const resetSimulation = useCallback(() => {
    setIsSimulating(false);
    cancelAnimationFrame(simAnimRef.current);
    setSimSpheres(null);
    physicsRef.current = null;
    setCameraOverride(null);
    // Reset DSL code to original
    const original = originalCodeRef.current;
    setCode(original);
    setDebouncedCode(original);
  }, []);

  // Simulation animation loop
  useEffect(() => {
    if (!isSimulating || !physicsRef.current) return;

    let running = true;
    const loop = () => {
      if (!running || !physicsRef.current) return;
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const updated = stepPhysics(physicsRef.current, scene.spheres, dt);
      setSimSpheres(updated);

      simAnimRef.current = requestAnimationFrame(loop);
    };
    simAnimRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(simAnimRef.current);
    };
  }, [isSimulating, scene.spheres]);

  return (
    <div className="h-screen flex flex-col bg-[var(--background-color-surface-base)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-color-base)] bg-[var(--background-color-surface-raised)]">
        <div className="flex items-center gap-3">
          <Text kind="title/md">⚡ WebGPU Ray Tracer</Text>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-brand)] text-white font-medium">
            Ray Tracing in One Weekend
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Physics controls - always show 3 elements for stable layout */}
          <div className="flex items-center gap-1.5 border border-[var(--border-color-base)] rounded px-2 py-1">
            {/* Play/Pause toggle */}
            <button
              onClick={isSimulating ? stopSimulation : startSimulation}
              className="text-xs px-2 py-0.5 rounded bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity font-medium flex items-center gap-1 w-20 justify-center"
            >
              {isSimulating ? <Pause size={12} /> : <Play size={12} />}{' '}
              {isSimulating ? 'Pause' : 'Play'}
            </button>
            {/* Reset */}
            <button
              onClick={resetSimulation}
              className="text-xs px-2 py-0.5 rounded bg-[var(--background-color-surface-sunken)] text-[var(--text-color-primary)] border border-[var(--border-color-base)] hover:opacity-90 transition-opacity font-medium"
              title="Reset"
            >
              <RotateCcw size={12} />
            </button>
            {/* Status indicator */}
            <span
              className={`text-[10px] px-1 ${isSimulating ? 'text-green-500 animate-pulse' : 'text-[var(--text-color-secondary)]'}`}
            >
              {isSimulating ? '●' : '○'}
            </span>
          </div>
          <Text kind="body/regular/sm" className="text-[var(--text-color-secondary)]">
            Right-drag: orbit • Scroll: zoom • Shift+right-drag: pan
          </Text>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Object list panel */}
        <div
          style={{ width: panel1.width }}
          className="flex flex-col bg-[var(--background-color-surface-base)] flex-shrink-0"
        >
          <ObjectControls
            scene={scene}
            code={code}
            onCodeChange={(newCode) => {
              setCode(newCode);
              setDebouncedCode(newCode);
            }}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onScrollTo={scrollToEditor}
          />
        </div>

        <DragHandle onMouseDown={panel1.onMouseDown} />

        {/* Editor panel */}
        <div style={{ width: panel2.width }} className="flex flex-col flex-shrink-0">
          <div className="px-4 py-2 border-b border-[var(--border-color-base)] bg-[var(--background-color-surface-raised)]">
            <Text kind="label/regular/md">Scene DSL</Text>
            <p className="text-xs text-[var(--text-color-secondary)] mt-0.5">
              Use &lt;Sphere&gt; and &lt;Camera&gt; tags to define your scene
            </p>
          </div>
          <div className="flex-1 min-h-0 p-2">
            <SceneEditor
              ref={editorRef}
              value={code}
              onChange={handleCodeChange}
              errors={scene.errors}
            />
          </div>
        </div>

        <DragHandle onMouseDown={panel2.onMouseDown} />

        {/* Render panel */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[var(--background-color-surface-sunken)]">
          <RayTracerCanvas
            spheres={activeSpheres}
            camera={activeCamera}
            width={800}
            height={450}
            onSphereDragEnd={handleSphereDragEnd}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onCameraChange={handleCameraChange}
            isSimulating={isSimulating}
            simSpheres={simSpheres}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-2 border-t border-[var(--border-color-base)] bg-[var(--background-color-surface-raised)] flex gap-6 text-xs text-[var(--text-color-secondary)]">
        <span>
          <code className="text-[var(--color-brand)]">&lt;Sphere&gt;</code> center, radius,
          material, color, fuzz, ior, velocity, elasticity
        </span>
        <span>
          <code className="text-[var(--color-brand)]">&lt;Camera&gt;</code> origin, lookat, vfov,
          defocusAngle, focusDist
        </span>
      </footer>
    </div>
  );
};

export default Index;
