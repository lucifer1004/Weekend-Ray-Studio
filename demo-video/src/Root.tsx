import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { composition, scenes } from "./demo.config";
import { getTotalDuration } from "./lib/timing";

export const RemotionRoot: React.FC = () => {
  const totalFrames = getTotalDuration(scenes, composition.fps);

  return (
    <>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={totalFrames}
        fps={composition.fps}
        width={composition.width}
        height={composition.height}
      />
    </>
  );
};
