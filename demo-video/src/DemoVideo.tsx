import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
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

  const fadeInFrames = fps * 2;  // 2 second fade-in
  const fadeOutFrames = fps * 3; // 3 second fade-out

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

export const DemoVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  let frameOffset = 0;

  const sceneElements = scenes.map((scene, i) => {
    const durationInFrames = Math.round(scene.durationInSeconds * fps);
    const from = frameOffset;
    frameOffset += durationInFrames;

    let content: React.ReactNode;
    switch (scene.type) {
      case "title":
        content = <TitleScene />;
        break;
      case "feature":
        content = <FeatureScene config={scene as FeatureSceneConfig} />;
        break;
      case "timeline":
        content = <TimelineScene milestones={(scene as TimelineSceneConfig).milestones} />;
        break;
      case "outro":
        content = <OutroScene />;
        break;
    }

    return (
      <Sequence
        key={i}
        from={from}
        durationInFrames={durationInFrames}
        name={
          scene.type === "feature"
            ? ((scene as FeatureSceneConfig).title ?? `Feature ${i}`)
            : scene.type === "timeline"
              ? "Under the Hood"
              : scene.type
        }
      >
        {content}

        {/* Per-scene voiceover */}
        {scene.voiceover && (
          <Audio src={staticFile(scene.voiceover)} volume={audio.voiceoverVolume} />
        )}

        {/* Subtitles */}
        {scene.subtitles && <Subtitle segments={scene.subtitles} />}
      </Sequence>
    );
  });

  const totalDuration = getTotalDuration(scenes, fps);

  return (
    <AbsoluteFill style={{ background: theme.colors.background }}>
      {sceneElements}

      {/* Global background music with fade-in/fade-out */}
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
