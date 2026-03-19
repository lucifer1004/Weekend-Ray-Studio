import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";
import { meta } from "../demo.config";
import { theme } from "../lib/theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: theme.colors.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <FadeIn delay={5} duration={15} slideUp={20}>
        <h2
          style={{
            color: theme.colors.text,
            fontSize: 56,
            fontFamily: theme.fonts.heading,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Thank you
        </h2>
      </FadeIn>

      <FadeIn delay={20} duration={15} slideUp={10}>
        <p
          style={{
            color: theme.colors.primary,
            fontSize: 24,
            fontFamily: theme.fonts.mono,
            margin: 0,
            marginTop: 24,
          }}
        >
          {meta.website}
        </p>
      </FadeIn>

      <FadeIn delay={30} duration={15}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 20,
            fontFamily: theme.fonts.body,
            margin: 0,
            marginTop: 16,
          }}
        >
          {meta.author} — {meta.event}
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};
