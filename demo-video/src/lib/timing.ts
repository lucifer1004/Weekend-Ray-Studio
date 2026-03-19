import type { DemoScene } from "../demo.config";

/** Calculate total duration in frames for all scenes */
export function getTotalDuration(scenes: DemoScene[], fps: number): number {
  return scenes.reduce((sum, s) => sum + s.durationInSeconds * fps, 0);
}

/** Get the frame range [startFrame, endFrame) for a scene by index */
export function getSceneRange(
  scenes: DemoScene[],
  index: number,
  fps: number
): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < index; i++) {
    start += scenes[i].durationInSeconds * fps;
  }
  return { start, end: start + scenes[index].durationInSeconds * fps };
}
