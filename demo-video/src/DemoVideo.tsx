import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  audio,
  scenes,
  type FeatureScene as FeatureSceneConfig,
  type TimelineScene as TimelineSceneConfig,
} from "./demo.config";
import { getTotalDuration } from "./lib/timing";
import { theme } from "./lib/theme";
import { Subtitle } from "./components/Subtitle";
import { FeatureScene } from "./scenes/FeatureScene";
import { OutroScene } from "./scenes/OutroScene";
import { TimelineScene } from "./scenes/TimelineScene";
import { TitleScene } from "./scenes/TitleScene";

/** Background music with fade-in and fade-out */
const BackgroundMusic: React.FC<{ totalDuration: number }> = ({ totalDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeInFrames = fps * 2;
  const fadeOutFrames = fps * 3;

  const volume = interpolate(
    frame,
    [0, fadeInFrames, totalDuration - fadeOutFrames, totalDuration],
    [0, audio.musicVolume, audio.musicVolume, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <Audio
      src={staticFile(audio.backgroundMusic!)}
      volume={volume}
      loop
    />
  );
};

/** Pick transition style based on scene types */
function getTransition(fromType: string, toType: string, fps: number) {
  // Title → feature: fade
  if (fromType === "title") {
    return { presentation: fade(), timing: linearTiming({ durationInFrames: Math.round(fps * 0.8) }) };
  }
  // Feature → feature: slide
  if (fromType === "feature" && toType === "feature") {
    return { presentation: slide({ direction: "from-right" }), timing: linearTiming({ durationInFrames: Math.round(fps * 0.5) }) };
  }
  // Feature → timeline: fade
  if (toType === "timeline") {
    return { presentation: fade(), timing: linearTiming({ durationInFrames: Math.round(fps * 0.8) }) };
  }
  // Timeline → outro: fade
  if (fromType === "timeline" || toType === "outro") {
    return { presentation: fade(), timing: linearTiming({ durationInFrames: Math.round(fps * 1.0) }) };
  }
  // Default: fade
  return { presentation: fade(), timing: linearTiming({ durationInFrames: Math.round(fps * 0.6) }) };
}

export const DemoVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const totalDuration = getTotalDuration(scenes, fps);

  // Build scene content list for TransitionSeries
  const sceneContents = scenes.map((scene) => {
    switch (scene.type) {
      case "title":
        return <TitleScene />;
      case "feature":
        return <FeatureScene config={scene as FeatureSceneConfig} />;
      case "timeline":
        return <TimelineScene milestones={(scene as TimelineSceneConfig).milestones} />;
      case "outro":
        return <OutroScene />;
    }
  });

  // Build subtitle sequences with absolute frame offsets
  let subtitleOffset = 0;
  const subtitleElements = scenes.map((scene, i) => {
    const durationInFrames = Math.round(scene.durationInSeconds * fps);
    const from = subtitleOffset;
    subtitleOffset += durationInFrames;

    return (
      <Sequence key={`sub-${i}`} from={from} durationInFrames={durationInFrames}>
        {scene.voiceover && (
          <Audio src={staticFile(scene.voiceover)} volume={audio.voiceoverVolume} />
        )}
        {scene.subtitles && <Subtitle segments={scene.subtitles} />}
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ background: theme.colors.background }}>
      {/* Scene transitions */}
      <TransitionSeries>
        {sceneContents.map((content, i) => {
          const durationInFrames = Math.round(scenes[i].durationInSeconds * fps);
          const elements: React.ReactNode[] = [];

          // Add transition before this scene (except the first)
          if (i > 0) {
            const trans = getTransition(scenes[i - 1].type, scenes[i].type, fps);
            elements.push(
              <TransitionSeries.Transition
                key={`t-${i}`}
                presentation={trans.presentation}
                timing={trans.timing}
              />
            );
          }

          elements.push(
            <TransitionSeries.Sequence key={`s-${i}`} durationInFrames={durationInFrames}>
              {content}
            </TransitionSeries.Sequence>
          );

          return elements;
        })}
      </TransitionSeries>

      {/* Subtitles + voiceover layer (above transitions) */}
      <AbsoluteFill style={{ zIndex: 20 }}>
        {subtitleElements}
      </AbsoluteFill>

      {/* Global background music */}
      {audio.backgroundMusic && (
        <Sequence from={0} durationInFrames={totalDuration} name="Background Music">
          <BackgroundMusic totalDuration={totalDuration} />
        </Sequence>
      )}

      {/* Global voiceover */}
      {audio.voiceover && (
        <Sequence from={0} durationInFrames={totalDuration} name="Voiceover">
          <Audio src={staticFile(audio.voiceover)} volume={audio.voiceoverVolume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
