/**
 * Demo Video Configuration — NVIDIA AI Hackathon Week 1
 *
 * Structure follows the recommended hackathon video flow:
 *   1. Team Intro (20-30s)
 *   2. Elevator Pitch (30-40s)
 *   3. Live Demo (45-60s)
 *   4. Under the Hood (60-90s)
 *   5. The "So What?" (20-30s)
 *
 * Workflow:
 *   1. Record app clips, place in public/clips/
 *   2. Edit scenes below
 *   3. `bun run studio` to preview, `bun run render` to export
 */

export type AnnotationPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export interface Annotation {
  atSecond: number;
  duration?: number;
  text: string;
  position: AnnotationPosition;
}

export interface SubtitleSegment {
  atSecond: number;
  duration: number;
  text: string;
  /** Audio file for this segment (relative to public/) */
  audio?: string;
}

export interface TitleScene {
  type: "title";
  durationInSeconds: number;
  voiceover?: string;
  subtitles?: SubtitleSegment[];
}

export interface FeatureScene {
  type: "feature";
  durationInSeconds: number;
  clip?: string;
  /** Video playback rate (default 1.0, e.g. 1.5 for 1.5x speed) */
  clipSpeed?: number;
  title?: string;
  annotations?: Annotation[];
  voiceover?: string;
  subtitles?: SubtitleSegment[];
}

export interface TimelineMilestone {
  agent: string;
  date: string;
  headline: string;
  details: string[];
  color?: string;
}

export interface TimelineScene {
  type: "timeline";
  durationInSeconds: number;
  milestones: TimelineMilestone[];
  voiceover?: string;
  subtitles?: SubtitleSegment[];
}

export interface OutroScene {
  type: "outro";
  durationInSeconds: number;
  voiceover?: string;
  subtitles?: SubtitleSegment[];
}

export type DemoScene = TitleScene | FeatureScene | TimelineScene | OutroScene;

// ─── Video settings ──────────────────────────────────────────────
export const composition = {
  width: 1920,
  height: 1080,
  fps: 30,
};

// ─── Presentation metadata ───────────────────────────────────────
export const meta = {
  title: "Weekend Ray Studio",
  subtitle: "Interactive Ray Tracing in the Browser",
  author: "Steins; Gate",
  members: ["Gabriel Wu"],
  event: "NVIDIA AI Hackathon Week 1",
  theme: "The Agentic Builder",
  website: "github.com/lucifer1004/weekend-ray-studio",
  problem:
    "Ray tracing is fascinating but hard to learn — we wanted to make it interactive, in the browser, with zero setup",
  // Outro content
  closingLines: [
    "Real-time path tracing in the browser — no install, no GPU drivers",
    "Built from idea to polished product in one weekend using AI agents",
    "Lovable scaffolded the app. Claude Code refined every layer.",
    "Even this demo video is a Remotion template built by Claude Code.",
  ],
  closingTagline: "The future of creative tooling is agentic.",
};

// ─── Audio ───────────────────────────────────────────────────────
export const audio = {
  backgroundMusic: "music/bgm.mp3" as string | undefined,
  musicVolume: 0.15,
  voiceover: undefined as string | undefined,
  voiceoverVolume: 1.0,
};

// ─── Subtitle helper ─────────────────────────────────────────────
// Specify [duration, text] or [duration, text, audioFile] — atSecond is computed automatically.
// Use [duration, null] for a silent gap (no subtitle shown).
function subs(segments: [number, string | null, string?][]): SubtitleSegment[] {
  const result: SubtitleSegment[] = [];
  let t = 0;
  for (const [duration, text, audio] of segments) {
    if (text !== null) {
      result.push({ atSecond: t, duration, text, ...(audio ? { audio } : {}) });
    }
    t += duration;
  }
  return result;
}

// ─── Clip registry ───────────────────────────────────────────────
// Define clip paths and their raw durations (seconds) once.
const clips = {
  render:       { path: "clips/render.mp4",       duration: 18.9 },
  editor:       { path: "clips/editor.mp4",       duration: 53.9 },
  play1:        { path: "clips/play-1.mp4",       duration: 35.1 },
  pitch:        { path: "clips/pitch.mp4",        duration: 23.5 },
} as const;

/** Pick a clip and auto-compute playbackRate to fill the given scene duration. */
function clip(c: { path: string; duration: number }, sceneDuration: number) {
  return { clip: c.path, clipSpeed: c.duration / sceneDuration };
}

// ─── Scene timeline ──────────────────────────────────────────────

export const scenes: DemoScene[] = [
  // ┌─────────────────────────────────────────────────────────────┐
  // │ 1. TEAM INTRO — audio: 19.8s                               │
  // └─────────────────────────────────────────────────────────────┘
  {
    type: "title",
    durationInSeconds: 22,
    subtitles: subs([
      [7.8, "Hey, I'm Gabriel from Team Steins Gate. For NVIDIA AI Hackathon Week One, we tackled a challenge:", "clips/vo-1-intro-0.wav"],
      [12.0, "Ray tracing is one of the most beautiful techniques in computer graphics, but it's hard to learn and even harder to experiment with interactively. We wanted to change that.", "clips/vo-1-intro-1.wav"],
    ]),
  },

  // ┌─────────────────────────────────────────────────────────────┐
  // │ 2. ELEVATOR PITCH — audio: 33.6s                           │
  // └─────────────────────────────────────────────────────────────┘
  {
    type: "feature",
    durationInSeconds: 36,
    ...clip(clips.pitch, 36),
    title: "The Elevator Pitch",
    subtitles: subs([
      [7.6, "We built Weekend Ray Studio — a real-time WebGPU path tracer that runs entirely in the browser.", "clips/vo-2-pitch-0.wav"],
      [11.7, "You write scenes in a JSX-like DSL, drag spheres in the viewport, and watch physics simulations with rolling and collisions — all rendered live.", "clips/vo-2-pitch-1.wav"],
      [14.3, "The twist? The entire app was built with AI agents. Lovable generated the scaffold from a single prompt. Claude Code refined every layer — physics, shaders, debugging, and even this video.", "clips/vo-2-pitch-2.wav"],
    ]),
  },

  // ┌─────────────────────────────────────────────────────────────┐
  // │ 3. LIVE DEMO — 3 clips                                     │
  // └─────────────────────────────────────────────────────────────┘

  // 3a. Rendering — audio: 20.7s
  {
    type: "feature",
    durationInSeconds: 22,
    ...clip(clips.render, 22),
    title: "GPU Ray Tracing",
    subtitles: subs([
      [9.0, "Here's the renderer in action. Each frame traces rays through the scene on the GPU using WebGPU compute shaders.", "clips/vo-3a-rendering-0.wav"],
      [11.7, "You can see it converge from noise to a clean image in seconds. Reflections, refractions through glass, soft shadows — all path traced in real time.", "clips/vo-3a-rendering-1.wav"],
    ]),
  },

  // 3b. Editor — audio: 18.0s
  {
    type: "feature",
    durationInSeconds: 20,
    ...clip(clips.editor, 20),
    title: "Scene Editor",
    subtitles: subs([
      [8.9, "The scene editor lets you build worlds visually. Write sphere and camera tags in the DSL, or use the sidebar controls.", "clips/vo-3b-editor-0.wav"],
      [9.1, "Click and drag any sphere directly in the viewport to reposition it. Changes update the ray-traced preview instantly.", "clips/vo-3b-editor-1.wav"],
    ]),
  },

  // 3c. Physics — audio: 16.7s
  {
    type: "feature",
    durationInSeconds: 19,
    ...clip(clips.play1, 19),
    title: "Physics Simulation",
    subtitles: subs([
      [7.1, "Hit play and the physics engine takes over. Spheres bounce with elastic collisions and roll across the ground.", "clips/vo-3c-physics-0.wav"],
      [9.6, "Tilt the ground plane and watch gravity pull them downhill. The UV grid lines on each sphere make the rotation clearly visible.", "clips/vo-3c-physics-1.wav"],
    ]),
  },

  // ┌─────────────────────────────────────────────────────────────┐
  // │ 4. UNDER THE HOOD — timeline view                          │
  // └─────────────────────────────────────────────────────────────┘
  {
    type: "timeline",
    durationInSeconds: 61,
    milestones: [
      {
        agent: "Lovable",
        date: "Mar 16 — Evening",
        headline: "One prompt → full scaffold",
        color: "#e74c3c",
        details: [
          "WebGPU compute shader ray tracer",
          "Monaco editor with React-like DSL",
          "Live preview with progressive rendering",
        ],
      },
      {
        agent: "Lovable",
        date: "Mar 17 — Morning",
        headline: "Interaction & physics",
        color: "#e74c3c",
        details: [
          "Sphere dragging with wireframe overlay",
          "Physics engine with elastic collisions",
          "Camera orbit, zoom, and pan controls",
        ],
      },
      {
        agent: "Claude Code",
        date: "Mar 19 — Daytime",
        headline: "Deep refinement & debugging",
        color: "#76b900",
        details: [
          "Quaternion rolling with UV grid lines",
          "Fixed shader alignment & tilt bugs",
          "Tilted-plane collision in normal space",
        ],
      },
      {
        agent: "Claude Code",
        date: "Mar 19 — Evening",
        headline: "Demo video & voice",
        color: "#76b900",
        details: [
          "Remotion template with config-driven scenes",
          "AI voice cloning & TTS voiceover",
          "This video was built by an agent too",
        ],
      },
    ],
    subtitles: subs([
      [12.8, "Let me show you how we built this. It started with a single prompt to Lovable — that gave us the full scaffold: WebGPU ray tracer, Monaco editor, React UI.", "clips/vo-4-architecture-0.wav"],
      [13.8, "Then Claude Code became our refinement agent. It built the physics engine from scratch — fixed-timestep simulation with quaternion orientation tracking for realistic rolling.", "clips/vo-4-architecture-1.wav"],
      [16.6, "The WGSL compute shader does twelve-bounce path tracing with progressive accumulation. Claude Code even found and fixed subtle bugs — like shader uniform alignment issues and friction math that only worked on flat ground.", "clips/vo-4-architecture-2.wav"],
      [15.6, "The agent debugged a tilted-plane collision system that needed normal-space calculations instead of world-space axes. And yes — this demo video is a Remotion template that Claude Code built and configured.", "clips/vo-4-architecture-3.wav"],
    ]),
  },

  // ┌─────────────────────────────────────────────────────────────┐
  // │ 5. THE "SO WHAT?" — audio: 28.2s                           │
  // └─────────────────────────────────────────────────────────────┘
  {
    type: "outro",
    durationInSeconds: 30,
    subtitles: subs([
      [9.0, "So why does this matter? We brought real-time path tracing to the browser — zero install, no GPU drivers needed.", "clips/vo-5-closing-0.wav"],
      [15.0, "We pushed WebGPU compute to its limits with a full ray tracer. And we proved that AI agents can build sophisticated graphics software — from initial scaffold to polished product — in a single weekend.", "clips/vo-5-closing-1.wav"],
      [4.2, "The future of creative tooling is agentic. Thank you.", "clips/vo-5-closing-2.wav"],
    ]),
  },
];
