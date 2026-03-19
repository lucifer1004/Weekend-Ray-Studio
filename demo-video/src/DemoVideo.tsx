import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { scenes, type FeatureScene as FeatureSceneConfig } from "./demo.config";
import { theme } from "./lib/theme";
import { FeatureScene } from "./scenes/FeatureScene";
import { OutroScene } from "./scenes/OutroScene";
import { TitleScene } from "./scenes/TitleScene";

export const DemoVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ background: theme.colors.background }}>
      {scenes.map((scene, i) => {
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
          case "outro":
            content = <OutroScene />;
            break;
        }

        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={durationInFrames}
            name={scene.type === "feature" ? (scene as FeatureSceneConfig).title ?? `Feature ${i}` : scene.type}
          >
            {content}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
