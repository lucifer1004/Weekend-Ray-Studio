# Weekend Ray Studio

A real-time WebGPU path tracer with an interactive scene editor, physics simulation, and rolling ball dynamics — built entirely with AI agents for NVIDIA AI Hackathon Week 1.

**Team Steins; Gate** | [Live Demo](https://weekend-ray-studio.lovable.app) | Theme: *The Agentic Builder*

## Features

- **GPU Ray Tracing** — WGSL compute shader with 12-bounce path tracing, progressive accumulation, Lambertian/Metal/Dielectric materials, reflections, refractions, and soft shadows
- **Scene DSL** — Write scenes in a JSX-like language (`<Sphere>`, `<Camera>`, `<Ground>`) with live preview in a Monaco editor
- **Direct Manipulation** — Click and drag spheres in the viewport, adjust properties via sidebar controls, orbit/zoom/pan the camera
- **Physics Simulation** — Elastic sphere collisions, gravity, ground bounce with configurable velocity and elasticity per sphere
- **Rolling Dynamics** — Quaternion-based orientation tracking with UV grid lines to visualize rotation
- **Tilted Ground** — Adjustable ground plane tilt with proper normal-space friction and collision

## How It Was Built

This project demonstrates agentic software development:

1. **Lovable** (Mar 16–17) — Generated the full app scaffold from conversational prompts: WebGPU ray tracer, Monaco editor, React UI, physics engine, camera controls
2. **Claude Code** (Mar 19) — Refined physics (quaternion rolling, tilted-plane collisions), fixed shader bugs (uniform alignment, friction math), built the demo video template, generated TTS voiceover

Even the demo video was built by Claude Code — a Remotion template with config-driven scenes, per-segment TTS audio, and auto-computed clip playback rates.

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev
```

Requires **WebGPU** support (Chrome 113+ / Edge 113+).

### Controls

| Action | Input |
|---|---|
| Select/drag sphere | Left-click |
| Orbit camera | Right-click drag |
| Zoom | Scroll wheel |
| Pan | Shift + right-click drag |
| Play/Pause physics | Play button in header |

## Demo Video

The `demo-video/` directory contains a reusable Remotion template for producing hackathon demo videos.

```bash
cd demo-video
bun install
bun run studio    # Preview in browser
bun run render    # Export to out/demo.mp4
```

Edit `src/demo.config.ts` to customize scenes, clips, subtitles, and voiceover.

### Voice Generation

Generate TTS voiceover using a local Qwen3-TTS model with voice cloning:

```bash
# Set QWEN3_TTS_MODEL_PATH in .env (or use HuggingFace ID as fallback)
pixi run python3 voice/generate_voiceover_local.py test       # Quick test
pixi run python3 voice/generate_voiceover_local.py generate   # All segments
```

## Tech Stack

- **Frontend** — React, TypeScript, Vite, Tailwind CSS, Monaco Editor
- **GPU** — WebGPU compute shaders (WGSL)
- **Physics** — Fixed-timestep simulation, impulse-based collisions, quaternion orientation
- **Demo Video** — Remotion, GLM/Qwen3-TTS voice cloning
- **AI Agents** — Lovable (scaffold), Claude Code (refinement)

## License

MIT
