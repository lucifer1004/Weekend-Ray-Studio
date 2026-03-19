"""
Generate demo video voiceover using Qwen3-TTS local model (MLX).

Generates one audio file per subtitle segment using voice cloning from a reference audio.
No API keys needed — runs entirely on-device.

Usage:
  pixi run python3 voice/generate_voiceover_local.py generate
  pixi run python3 voice/generate_voiceover_local.py generate --speed 1.2
  pixi run python3 voice/generate_voiceover_local.py single "Hello world" output.wav
  pixi run python3 voice/generate_voiceover_local.py test   # quick test with first segment

Requires: mlx-audio (pixi add mlx-audio)
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv

# ─── Config ───────────────────────────────────────────────────────

load_dotenv(Path(__file__).parent.parent / ".env")
MODEL_ID = os.environ.get("QWEN3_TTS_MODEL_PATH", "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit")
REF_AUDIO = Path(__file__).parent / "sample.wav"
REF_TEXT = "The workflow is clone your voice using your audio sample, generate voiceover for each scene using the cloned voice, drop audio files into the Remotion template."
OUTPUT_DIR = Path(__file__).parent.parent / "demo-video" / "public" / "clips"

# Pronunciation fixes — applied to TTS input only, subtitles stay correct.
PRONUNCIATION_FIXES = {
    "Monaco": "Monnaco",
    "Monaco editor": "Monnaco editor",
    "Agentic": "Ay-jentic",
    "agentic": "ay-jentic",
    "WebGPU": "Web G P U",
    "WGSL": "W G S L",
    "DSL": "D S L",
    "JSX": "J S X",
    "GPU": "G P U",
    "NVIDIA": "En-vidia",
    "Remotion": "Reh-motion",
    "quaternion": "kwuh-ternion",
    "Lovable": "Loveable",
    "Claude Code": "Clawed Code",
    "Claude": "Clawed",
    "timestep": "time-step",
    "fixed-timestep": "fixed time-step",
}


def apply_pronunciation_fixes(text: str) -> str:
    for original, replacement in PRONUNCIATION_FIXES.items():
        text = text.replace(original, replacement)
    return text


# Each scene split into 2-3 sentence chunks for natural flow.
# None = silent gap (skipped in output).
SCENE_SEGMENTS: dict[str, list[str | None]] = {
    "1-intro": [
        "Hey, I'm Gabriel from Team Steins Gate. For NVIDIA AI Hackathon Week One, we tackled a challenge:",
        "ray tracing is one of the most beautiful techniques in computer graphics, but it's hard to learn and even harder to experiment with interactively. We wanted to change that.",
    ],
    "2-pitch": [
        "We built Weekend Ray Studio — a real-time WebGPU path tracer that runs entirely in the browser.",
        "You write scenes in a JSX-like DSL, drag spheres in the viewport, and watch physics simulations with rolling and collisions — all rendered live.",
        "The twist? The entire app was built with AI agents. Lovable generated the scaffold from a single prompt. Claude Code refined every layer — physics, shaders, debugging, and even this video.",
    ],
    "3a-rendering": [
        "Here's the renderer in action. Each frame traces rays through the scene on the GPU using WebGPU compute shaders.",
        "You can see it converge from noise to a clean image in seconds. Reflections, refractions through glass, soft shadows — all path traced in real time.",
    ],
    "3b-editor": [
        "The scene editor lets you build worlds visually. Write sphere and camera tags in the DSL, or use the sidebar controls.",
        "Click and drag any sphere directly in the viewport to reposition it. Changes update the ray-traced preview instantly.",
    ],
    "3c-physics": [
        "Hit play and the physics engine takes over. Spheres bounce with elastic collisions and roll across the ground.",
        "Tilt the ground plane and watch gravity pull them downhill. The UV grid lines on each sphere make the rotation clearly visible.",
    ],
    "4-architecture": [
        "Let me show you how we built this. It started with a single prompt to Lovable — that gave us the full scaffold: WebGPU ray tracer, Monaco editor, React UI.",
        "Then Claude Code became our refinement agent. It built the physics engine from scratch — fixed-timestep simulation with quaternion orientation tracking for realistic rolling.",
        "The WGSL compute shader does twelve-bounce path tracing with progressive accumulation. Claude Code even found and fixed subtle bugs — like shader uniform alignment issues and friction math that only worked on flat ground.",
        "The agent debugged a tilted-plane collision system that needed normal-space calculations instead of world-space axes. And yes — this demo video is a Remotion template that Claude Code built and configured.",
    ],
    "5-closing": [
        "So why does this matter? We brought real-time path tracing to the browser — zero install, no GPU drivers needed.",
        "We pushed WebGPU compute to its limits with a full ray tracer. And we proved that AI agents can build sophisticated graphics software — from initial scaffold to polished product — in a single weekend.",
        "The future of creative tooling is agentic. Thank you.",
    ],
}


# ─── Model loading ────────────────────────────────────────────────

# ─── Generation ───────────────────────────────────────────────────

def generate_segment(text: str, output_path: str, speed: float = 1.0):
    """Generate a single audio segment using the local model."""
    from mlx_audio.tts.generate import generate_audio

    tts_text = apply_pronunciation_fixes(text)

    if not REF_AUDIO.exists():
        print(f"Error: Reference audio not found at {REF_AUDIO}")
        sys.exit(1)

    prefix = output_path.replace(".wav", "")

    generate_audio(
        model=MODEL_ID,
        text=tts_text,
        ref_audio=str(REF_AUDIO),
        ref_text=REF_TEXT,
        file_prefix=prefix,
        speed=speed,
    )

    # The library outputs as {prefix}_000.wav — rename to {prefix}.wav
    expected = Path(f"{prefix}.wav")
    for alt_suffix in ["_000.wav", "_0.wav", "_00.wav"]:
        alt = Path(f"{prefix}{alt_suffix}")
        if alt.exists():
            shutil.move(str(alt), str(expected))
            break

    if expected.exists():
        size = expected.stat().st_size
        print(f"    → {expected} ({size} bytes)")
        return True
    else:
        print(f"    FAILED: no output file found")
        return False


# ─── Commands ─────────────────────────────────────────────────────

def cmd_test(speed: float):
    """Quick test with the first segment."""
    text = SCENE_SEGMENTS["1-intro"][0]
    print(f"Test: {text}")
    out = str(Path(__file__).parent / "test_local.wav")
    generate_segment(text, out, speed=speed)


def cmd_generate(speed: float):
    """Generate all voiceover segments."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total = sum(len([s for s in segs if s]) for segs in SCENE_SEGMENTS.values())
    count = 0

    for scene_name, segments in SCENE_SEGMENTS.items():
        text_segments = [s for s in segments if s is not None]
        print(f"\n[{scene_name}] {len(text_segments)} segments")

        for i, seg in enumerate(text_segments):
            count += 1
            print(f"  [{count}/{total}] {seg[:60]}...")
            out_path = str(OUTPUT_DIR / f"vo-{scene_name}-{i}.wav")
            generate_segment(seg, out_path, speed=speed)

    print("\n--- Done! ---")
    print("Segment files: clips/vo-{scene}-{index}.wav")
    print("Wire them into demo.config.ts subtitle entries.")


def cmd_single(text: str, output: str, speed: float):
    """Generate a single clip."""
    print(f"Generating: {text[:60]}...")
    generate_segment(text, output, speed=speed)


# ─── CLI ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate voiceover with Qwen3-TTS (local)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed (e.g. 1.2)")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("test", help="Quick test with first segment")
    sub.add_parser("generate", help="Generate all voiceover segments")

    p = sub.add_parser("single", help="Generate one clip")
    p.add_argument("text")
    p.add_argument("output")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    match args.command:
        case "test":
            cmd_test(args.speed)
        case "generate":
            cmd_generate(args.speed)
        case "single":
            cmd_single(args.text, args.output, args.speed)


if __name__ == "__main__":
    main()
