import { Text } from '@nvidia/foundations-react-core';
import { useState } from 'react';
import type { ParsedScene } from '../lib/scene-dsl';

interface ObjectControlsProps {
  scene: ParsedScene;
  code: string;
  onCodeChange: (code: string) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onScrollTo?: (index: number) => void;
}

const MATERIAL_OPTIONS = ['lambertian', 'metal', 'dielectric'] as const;
const MATERIAL_ICONS: Record<string, string> = {
  lambertian: '🟤',
  metal: '🪩',
  dielectric: '💎',
};
const MATERIAL_TYPE_MAP: Record<number, string> = {
  0: 'lambertian',
  1: 'metal',
  2: 'dielectric',
};

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [parseFloat(r.toFixed(2)), parseFloat(g.toFixed(2)), parseFloat(b.toFixed(2))];
}

// Find the nth <Sphere .../> or <Camera .../> tag in code and return its start/end indices
function findTagRange(
  code: string,
  tagName: string,
  index: number
): { start: number; end: number } | null {
  const re = new RegExp(`<${tagName}\\s[^/]*?/>`, 'gs');
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(code)) !== null) {
    if (count === index) {
      return { start: m.index, end: m.index + m[0].length };
    }
    count++;
  }
  return null;
}

function updateProp(tagStr: string, prop: string, value: string): string {
  // Check if prop exists
  const propRe = new RegExp(`(${prop})\\s*=\\s*(?:"[^"]*"|{[^}]*})`);
  if (propRe.test(tagStr)) {
    return tagStr.replace(propRe, `${prop}={${value}}`);
  }
  // Add before />
  return tagStr.replace(/\s*\/>/, `\n    ${prop}={${value}}\n  />`);
}

function removeProp(tagStr: string, prop: string): string {
  const propRe = new RegExp(`\\s*${prop}\\s*=\\s*(?:"[^"]*"|{[^}]*})`, 'g');
  return tagStr.replace(propRe, '');
}

const Slider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-[var(--text-color-secondary)] w-6 flex-shrink-0">
      {label}
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1 accent-[var(--color-brand)]"
    />
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-14 text-[10px] px-1 py-0.5 rounded bg-[var(--background-color-surface-sunken)] border border-[var(--border-color-base)] text-[var(--text-color-primary)] text-right"
    />
  </div>
);

export const ObjectControls = ({
  scene,
  code,
  onCodeChange,
  selectedIndex,
  onSelect,
  onScrollTo,
}: ObjectControlsProps) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const updateSphereInCode = (sphereIdx: number, prop: string, value: string) => {
    const range = findTagRange(code, 'Sphere', sphereIdx);
    if (!range) return;
    const tagStr = code.slice(range.start, range.end);
    const updated = updateProp(tagStr, prop, value);
    onCodeChange(code.slice(0, range.start) + updated + code.slice(range.end));
  };

  const updateCameraInCode = (prop: string, value: string) => {
    const range = findTagRange(code, 'Camera', 0);
    if (!range) return;
    const tagStr = code.slice(range.start, range.end);
    const updated = updateProp(tagStr, prop, value);
    onCodeChange(code.slice(0, range.start) + updated + code.slice(range.end));
  };

  const deleteSphere = (sphereIdx: number) => {
    const range = findTagRange(code, 'Sphere', sphereIdx);
    if (!range) return;
    // Also remove surrounding whitespace/newlines
    let start = range.start;
    let end = range.end;
    while (start > 0 && code[start - 1] === ' ') start--;
    if (start > 0 && code[start - 1] === '\n') start--;
    while (end < code.length && code[end] === '\n') {
      end++;
      break;
    }
    onCodeChange(code.slice(0, start) + code.slice(end));
    onSelect(null);
  };

  const addSphere = () => {
    const insertion = `\n  <Sphere\n    center={[${(Math.random() * 4 - 2).toFixed(1)}, 0.5, ${(Math.random() * 4 - 2).toFixed(1)}]}\n    radius={0.5}\n    material="lambertian"\n    color={[${Math.random().toFixed(2)}, ${Math.random().toFixed(2)}, ${Math.random().toFixed(2)}]}\n    velocity={[0, 0, 0]}\n    elasticity={0.8}\n  />`;
    const closeIdx = code.lastIndexOf('</Scene>');
    if (closeIdx >= 0) {
      onCodeChange(`${code.slice(0, closeIdx) + insertion}\n${code.slice(closeIdx)}`);
    } else {
      onCodeChange(code + insertion);
    }
  };

  const updateSphereCenter = (idx: number, axis: number, val: number) => {
    const c = [...scene.spheres[idx].center];
    c[axis] = val;
    updateSphereInCode(idx, 'center', `[${c.map((n) => n.toFixed(1)).join(', ')}]`);
  };

  const updateSphereVelocity = (idx: number, axis: number, val: number) => {
    const v = [...scene.spheres[idx].velocity];
    v[axis] = val;
    updateSphereInCode(idx, 'velocity', `[${v.map((n) => n.toFixed(1)).join(', ')}]`);
  };

  const updateSphereColor = (idx: number, hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    updateSphereInCode(idx, 'color', `[${r}, ${g}, ${b}]`);
  };

  const updateSphereMaterial = (idx: number, mat: string) => {
    const range = findTagRange(code, 'Sphere', idx);
    if (!range) return;
    let tagStr = code.slice(range.start, range.end);
    tagStr = updateProp(tagStr, 'material', `"${mat}"`);
    // Clean up irrelevant props
    if (mat === 'lambertian') {
      tagStr = removeProp(tagStr, 'fuzz');
      tagStr = removeProp(tagStr, 'ior');
    } else if (mat === 'metal') {
      tagStr = removeProp(tagStr, 'ior');
      if (!/fuzz/.test(tagStr)) tagStr = updateProp(tagStr, 'fuzz', '0.0');
    } else if (mat === 'dielectric') {
      tagStr = removeProp(tagStr, 'fuzz');
      tagStr = removeProp(tagStr, 'color');
      if (!/ior/.test(tagStr)) tagStr = updateProp(tagStr, 'ior', '1.5');
    }
    onCodeChange(code.slice(0, range.start) + tagStr + code.slice(range.end));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-color-base)] bg-[var(--background-color-surface-raised)] flex items-center justify-between">
        <Text kind="label/regular/md">Objects ({scene.spheres.length + 1})</Text>
        <button
          onClick={addSphere}
          className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity font-medium"
        >
          + Add Sphere
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Camera controls */}
        <div className="border-b border-[var(--border-color-base)]">
          <button
            className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--background-color-surface-raised)] transition-colors ${
              selectedIndex === -1
                ? 'bg-[var(--background-color-surface-raised)] ring-1 ring-inset ring-[var(--color-brand)]'
                : ''
            }`}
            onClick={() => {
              onSelect(selectedIndex === -1 ? null : -1);
              toggleCollapse(-1);
              onScrollTo?.(-1);
            }}
          >
            <span className="text-xs">{collapsed.has(-1) ? '▶' : '▼'}</span>
            <span className="text-sm">📷</span>
            <span className="text-xs font-medium text-[var(--text-color-primary)]">Camera</span>
          </button>
          {!collapsed.has(-1) && selectedIndex === -1 && (
            <div className="px-3 pb-2 space-y-1.5">
              <div className="text-[10px] text-[var(--text-color-secondary)] font-medium mt-1">
                Origin
              </div>
              {['X', 'Y', 'Z'].map((axis, i) => (
                <Slider
                  key={axis}
                  label={axis}
                  value={scene.camera.origin[i]}
                  min={-20}
                  max={20}
                  step={0.5}
                  onChange={(v) => {
                    const o = [...scene.camera.origin];
                    o[i] = v;
                    updateCameraInCode('origin', `[${o.map((n) => n.toFixed(1)).join(', ')}]`);
                  }}
                />
              ))}
              <div className="text-[10px] text-[var(--text-color-secondary)] font-medium mt-1">
                Look At
              </div>
              {['X', 'Y', 'Z'].map((axis, i) => (
                <Slider
                  key={`la${axis}`}
                  label={axis}
                  value={scene.camera.lookat[i]}
                  min={-20}
                  max={20}
                  step={0.5}
                  onChange={(v) => {
                    const l = [...scene.camera.lookat];
                    l[i] = v;
                    updateCameraInCode('lookat', `[${l.map((n) => n.toFixed(1)).join(', ')}]`);
                  }}
                />
              ))}
              <Slider
                label="FOV"
                value={scene.camera.vfov}
                min={5}
                max={120}
                step={1}
                onChange={(v) => updateCameraInCode('vfov', String(v))}
              />
              <Slider
                label="DoF"
                value={scene.camera.defocusAngle}
                min={0}
                max={10}
                step={0.1}
                onChange={(v) => updateCameraInCode('defocusAngle', v.toFixed(1))}
              />
              <Slider
                label="Foc"
                value={scene.camera.focusDist}
                min={0.1}
                max={30}
                step={0.1}
                onChange={(v) => updateCameraInCode('focusDist', v.toFixed(1))}
              />
            </div>
          )}
        </div>

        {/* Sphere controls */}
        {scene.spheres.map((sphere, i) => {
          const isSelected = selectedIndex === i;
          const isCollapsed = collapsed.has(i);
          const colorHex = rgbToHex(sphere.color[0], sphere.color[1], sphere.color[2]);
          const label = sphere.radius >= 100 ? 'Ground' : `Sphere ${i + 1}`;
          const matName = MATERIAL_TYPE_MAP[sphere.materialType] || 'lambertian';

          return (
            <div key={i} className="border-b border-[var(--border-color-base)]">
              <button
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--background-color-surface-raised)] transition-colors ${
                  isSelected
                    ? 'bg-[var(--background-color-surface-raised)] ring-1 ring-inset ring-[var(--color-brand)]'
                    : ''
                }`}
                onClick={() => {
                  onSelect(isSelected ? null : i);
                  if (!isSelected) {
                    const next = new Set(collapsed);
                    next.delete(i);
                    setCollapsed(next);
                  }
                  onScrollTo?.(i);
                }}
              >
                <span className="text-xs">{isSelected && !isCollapsed ? '▼' : '▶'}</span>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-[var(--border-color-base)]"
                  style={{ backgroundColor: colorHex }}
                />
                <span className="text-xs font-medium text-[var(--text-color-primary)] flex-1">
                  {MATERIAL_ICONS[matName]} {label}
                </span>
                {/* biome-ignore lint/a11y/useSemanticElements: cannot nest button inside button */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSphere(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      deleteSphere(i);
                    }
                  }}
                  className="text-[10px] text-[var(--text-color-secondary)] hover:text-red-400 px-1 cursor-pointer"
                  title="Delete"
                >
                  ✕
                </span>
              </button>

              {isSelected && !isCollapsed && (
                <div className="px-3 pb-2 space-y-1.5">
                  {/* Material */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-color-secondary)] w-10">Mat</span>
                    <select
                      value={matName}
                      onChange={(e) => updateSphereMaterial(i, e.target.value)}
                      className="flex-1 text-[10px] px-1 py-0.5 rounded bg-[var(--background-color-surface-sunken)] border border-[var(--border-color-base)] text-[var(--text-color-primary)]"
                    >
                      {MATERIAL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {MATERIAL_ICONS[m]} {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Color */}
                  {matName !== 'dielectric' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-color-secondary)] w-10">
                        Color
                      </span>
                      <input
                        type="color"
                        value={colorHex}
                        onChange={(e) => updateSphereColor(i, e.target.value)}
                        className="w-6 h-5 rounded border border-[var(--border-color-base)] cursor-pointer"
                      />
                      <span className="text-[10px] text-[var(--text-color-secondary)]">
                        {colorHex}
                      </span>
                    </div>
                  )}

                  {/* Position */}
                  <div className="text-[10px] text-[var(--text-color-secondary)] font-medium">
                    Position
                  </div>
                  {['X', 'Y', 'Z'].map((axis, ai) => (
                    <Slider
                      key={axis}
                      label={axis}
                      value={sphere.center[ai]}
                      min={sphere.radius >= 100 ? -1000 : -10}
                      max={sphere.radius >= 100 ? 1000 : 10}
                      step={0.1}
                      onChange={(v) => updateSphereCenter(i, ai, v)}
                    />
                  ))}

                  {/* Radius */}
                  <Slider
                    label="R"
                    value={sphere.radius}
                    min={0.05}
                    max={sphere.radius >= 100 ? 2000 : 5}
                    step={0.05}
                    onChange={(v) => updateSphereInCode(i, 'radius', v.toFixed(2))}
                  />

                  {/* Metal fuzz */}
                  {matName === 'metal' && (
                    <Slider
                      label="Fuzz"
                      value={sphere.fuzzOrIor}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => updateSphereInCode(i, 'fuzz', v.toFixed(2))}
                    />
                  )}

                  {/* Dielectric IOR */}
                  {matName === 'dielectric' && (
                    <Slider
                      label="IOR"
                      value={sphere.fuzzOrIor}
                      min={1}
                      max={3}
                      step={0.01}
                      onChange={(v) => updateSphereInCode(i, 'ior', v.toFixed(2))}
                    />
                  )}

                  {/* Velocity */}
                  {sphere.radius < 100 && (
                    <>
                      <div className="text-[10px] text-[var(--text-color-secondary)] font-medium mt-1">
                        Velocity
                      </div>
                      {['X', 'Y', 'Z'].map((axis, ai) => (
                        <Slider
                          key={`v${axis}`}
                          label={axis}
                          value={sphere.velocity[ai]}
                          min={-20}
                          max={20}
                          step={0.5}
                          onChange={(v) => updateSphereVelocity(i, ai, v)}
                        />
                      ))}
                      <Slider
                        label="Elst"
                        value={sphere.elasticity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSphereInCode(i, 'elasticity', v.toFixed(2))}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
