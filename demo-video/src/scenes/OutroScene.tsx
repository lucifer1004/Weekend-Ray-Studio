import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FadeIn } from "../components/FadeIn";
import { meta } from "../demo.config";
import { theme } from "../lib/theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${theme.colors.surface} 0%, ${theme.colors.background} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      {/* Closing bullet points */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 900,
          marginBottom: 48,
        }}
      >
        {meta.closingLines.map((line, i) => (
          <FadeIn key={i} delay={10 + i * 15} duration={15} slideUp={15}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span
                style={{
                  color: theme.colors.primary,
                  fontSize: 20,
                  lineHeight: 1.6,
                  flexShrink: 0,
                }}
              >
                ▸
              </span>
              <span
                style={{
                  color: theme.colors.text,
                  fontSize: 26,
                  fontFamily: theme.fonts.body,
                  fontWeight: 400,
                  lineHeight: 1.6,
                }}
              >
                {line}
              </span>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Divider */}
      <FadeIn delay={10 + meta.closingLines.length * 15} duration={15}>
        <div
          style={{
            width: 60,
            height: 3,
            background: theme.colors.primary,
            borderRadius: 2,
            marginBottom: 24,
          }}
        />
      </FadeIn>

      {/* Tagline */}
      <FadeIn
        delay={15 + meta.closingLines.length * 15}
        duration={20}
        slideUp={10}
      >
        <p
          style={{
            color: theme.colors.primary,
            fontSize: 32,
            fontFamily: theme.fonts.heading,
            fontWeight: 600,
            margin: 0,
            marginBottom: 24,
            fontStyle: "italic",
          }}
        >
          {meta.closingTagline}
        </p>
      </FadeIn>

      {/* Repo + team */}
      <FadeIn
        delay={25 + meta.closingLines.length * 15}
        duration={15}
        slideUp={10}
      >
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 20,
            fontFamily: theme.fonts.mono,
            margin: 0,
          }}
        >
          {meta.website}
        </p>
      </FadeIn>

      <FadeIn
        delay={30 + meta.closingLines.length * 15}
        duration={15}
      >
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 18,
            fontFamily: theme.fonts.body,
            margin: 0,
            marginTop: 8,
          }}
        >
          {meta.author} — {meta.event}
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};
