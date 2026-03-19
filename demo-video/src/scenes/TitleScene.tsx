import {
  AbsoluteFill,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FadeIn } from "../components/FadeIn";
import { meta } from "../demo.config";
import { theme } from "../lib/theme";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      {/* Background image */}
      <Video
        src={staticFile("images/intro.mp4")}
        volume={0}
        playbackRate={0.5}
        pauseWhenBuffering
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.4,
        }}
      />
      {/* Dark overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 70%)",
        }}
      />
      {/* Text content — above background */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Event badge */}
      <FadeIn delay={5} duration={15} slideUp={10}>
        <div
          style={{
            background: theme.colors.primary,
            color: theme.colors.background,
            fontSize: 16,
            fontFamily: theme.fonts.mono,
            fontWeight: 700,
            padding: "6px 16px",
            borderRadius: 6,
            marginBottom: 32,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {meta.event}
        </div>
      </FadeIn>

      {/* Theme */}
      <FadeIn delay={10} duration={15} slideUp={10}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 20,
            fontFamily: theme.fonts.mono,
            fontWeight: 500,
            margin: 0,
            marginBottom: 12,
            letterSpacing: 1,
          }}
        >
          {meta.theme}
        </p>
      </FadeIn>

      {/* Title */}
      <FadeIn delay={20} duration={20} slideUp={30}>
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
      <FadeIn delay={35} duration={20} slideUp={20}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 30,
            fontFamily: theme.fonts.body,
            fontWeight: 400,
            margin: 0,
            marginTop: 12,
          }}
        >
          {meta.subtitle}
        </p>
      </FadeIn>

      {/* Divider */}
      <FadeIn delay={50} duration={15}>
        <div
          style={{
            width: 60,
            height: 3,
            background: theme.colors.primary,
            borderRadius: 2,
            marginTop: 40,
            marginBottom: 32,
          }}
        />
      </FadeIn>

      {/* Team name */}
      <FadeIn delay={55} duration={20} slideUp={15}>
        <p
          style={{
            color: theme.colors.text,
            fontSize: 28,
            fontFamily: theme.fonts.heading,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Team {meta.author}
        </p>
      </FadeIn>

      {/* Members */}
      <FadeIn delay={65} duration={15} slideUp={10}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 22,
            fontFamily: theme.fonts.body,
            margin: 0,
            marginTop: 8,
          }}
        >
          {meta.members.join(" · ")}
        </p>
      </FadeIn>

      {/* Problem statement */}
      <FadeIn delay={fps * 3} duration={20} slideUp={15}>
        <p
          style={{
            color: theme.colors.textMuted,
            fontSize: 22,
            fontFamily: theme.fonts.body,
            fontWeight: 400,
            fontStyle: "italic",
            margin: 0,
            marginTop: 40,
            maxWidth: 800,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          "{meta.problem}"
        </p>
      </FadeIn>
      </div>
    </AbsoluteFill>
  );
};
