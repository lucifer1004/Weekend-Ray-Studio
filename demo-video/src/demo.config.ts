/**
 * Demo Video Configuration
 *
 * Edit this file to define your demo video.
 * Drop pre-recorded clips into public/clips/ and reference them here.
 *
 * Workflow:
 *   1. Record app clips (screen capture or canvas export)
 *   2. Place .webm/.mp4 files in public/clips/
 *   3. Define scenes below
 *   4. Run `bun run studio` to preview, `bun run render` to export
 */

export type AnnotationPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export interface Annotation {
  /** When to show this annotation (seconds from scene start) */
  atSecond: number;
  /** How long to show it (seconds, default 4) */
  duration?: number;
  /** The annotation text */
  text: string;
  /** Screen position */
  position: AnnotationPosition;
}

export interface TitleScene {
  type: "title";
  durationInSeconds: number;
}

export interface FeatureScene {
  type: "feature";
  durationInSeconds: number;
  /** Path to pre-recorded clip (relative to public/). Omit to show placeholder. */
  clip?: string;
  /** Section title shown at the top */
  title?: string;
  /** Timed annotations overlaid on the clip */
  annotations?: Annotation[];
}

export interface OutroScene {
  type: "outro";
  durationInSeconds: number;
}

export type DemoScene = TitleScene | FeatureScene | OutroScene;

// ─── Video settings ──────────────────────────────────────────────
export const composition = {
  width: 1920,
  height: 1080,
  fps: 30,
};

// ─── Presentation metadata ───────────────────────────────────────
export const meta = {
  title: "Weekend Ray Studio",
  subtitle: "Ray Tracing in One Weekend — Interactive Edition",
  author: "Steins; Gate",
  event: "NVIDIA AI Hackathon Week 1",
  website: "github.com/lucifer1004/weekend-ray-studio",
};

// ─── Scene timeline ──────────────────────────────────────────────
// Each scene plays sequentially. Total video length = sum of all durations.
export const scenes: DemoScene[] = [
  // --- Opening title ---
  {
    type: "title",
    durationInSeconds: 5,
  },

  // --- Feature 1: Scene editor ---
  // Add clip: "clips/editor-demo.webm" after recording
  {
    type: "feature",
    durationInSeconds: 40,
    title: "Declarative Scene Editor",
    annotations: [
      { atSecond: 2, text: "Write scenes in a JSX-like DSL", position: "top-left" },
      { atSecond: 10, text: "Drag spheres directly in the viewport", position: "bottom-right" },
      { atSecond: 20, text: "Adjust materials, colors, and properties", position: "top-left" },
    ],
  },

  // --- Feature 2: Physics ---
  // Add clip: "clips/physics-demo.webm" after recording
  {
    type: "feature",
    durationInSeconds: 30,
    title: "Real-time Physics",
    annotations: [
      { atSecond: 2, text: "Sphere collisions with elasticity", position: "top-left" },
      { atSecond: 12, text: "Tilt the ground — balls roll with quaternion rotation", position: "bottom-right" },
    ],
  },

  // --- Feature 3: Ray tracing quality ---
  // Add clip: "clips/rendering-demo.webm" after recording
  {
    type: "feature",
    durationInSeconds: 30,
    title: "GPU Ray Tracing",
    annotations: [
      { atSecond: 2, text: "Progressive path tracing on the GPU via WebGPU", position: "top-left" },
      { atSecond: 15, text: "Reflections, refractions, and soft shadows", position: "bottom-right" },
    ],
  },

  // --- Closing ---
  {
    type: "outro",
    durationInSeconds: 5,
  },
];
