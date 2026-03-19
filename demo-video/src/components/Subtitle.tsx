import { Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleSegment } from "../demo.config";
import { theme } from "../lib/theme";

interface SubtitleProps {
  segments: SubtitleSegment[];
}

const SubtitleText: React.FC<{ segment: SubtitleSegment; durationInFrames: number }> = ({
  segment,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.6, stiffness: 140 },
  });
  // Smooth fade out
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const slideY = 12 * (1 - entrance);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(entrance, fadeOut),
        transform: `translateY(${slideY}px)`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "10px 24px",
          maxWidth: "80%",
        }}
      >
        <span
          style={{
            color: theme.colors.text,
            fontSize: 26,
            fontFamily: theme.fonts.body,
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          {segment.text}
        </span>
      </div>
    </div>
  );
};

export const Subtitle: React.FC<SubtitleProps> = ({ segments }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {segments.map((seg, i) => {
        const from = Math.round(seg.atSecond * fps);
        const durationInFrames = Math.round(seg.duration * fps);

        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <SubtitleText segment={seg} durationInFrames={durationInFrames} />
            {seg.audio && (
              <Audio src={staticFile(seg.audio)} volume={1} />
            )}
          </Sequence>
        );
      })}
    </>
  );
};
