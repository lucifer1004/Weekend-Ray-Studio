import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";
import { meta } from "../demo.config";
import { theme } from "../lib/theme";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade out near the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${theme.colors.surface} 0%, ${theme.colors.background} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      {/* Decorative accent line */}
      <FadeIn delay={10} duration={20}>
        <div
          style={{
            width: 60,
            height: 3,
            background: theme.colors.primary,
            borderRadius: 2,
            marginBottom: 32,
          }}
        />
      </FadeIn>

      {/* Title */}
      <FadeIn delay={15} duration={20} slideUp={30}>
        <h1
          style={{
            color: theme.colors.text,
            fontSize: 80,
            fontFamily: theme.fonts.heading,
            fontWeight: 700,
            margin: 0,
            letterSpacing: -2,
          }}
        >
          {meta.title}
        </h1>
      </FadeIn>

      {/* Subtitle */}
      <FadeIn delay={30} duration={20} slideUp={20}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 32,
            fontFamily: theme.fonts.body,
            fontWeight: 400,
            margin: 0,
            marginTop: 16,
          }}
        >
          {meta.subtitle}
        </p>
      </FadeIn>

      {/* Event / author */}
      <FadeIn delay={45} duration={20} slideUp={10}>
        <p
          style={{
            color: theme.colors.primary,
            fontSize: 22,
            fontFamily: theme.fonts.mono,
            fontWeight: 500,
            margin: 0,
            marginTop: 48,
          }}
        >
          {meta.event} — {meta.author}
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};
