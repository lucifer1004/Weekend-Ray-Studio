import { Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
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

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(fadeIn, fadeOut),
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.7)",
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
