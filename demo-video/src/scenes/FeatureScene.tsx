import {
  AbsoluteFill,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Annotation } from "../components/Annotation";
import type { FeatureScene as FeatureSceneConfig } from "../demo.config";
import { theme } from "../lib/theme";

interface FeatureSceneProps {
  config: FeatureSceneConfig;
}

const ClipPlaceholder: React.FC<{ title?: string }> = ({ title }) => (
  <AbsoluteFill
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: theme.colors.surface,
    }}
  >
    <span style={{ fontSize: 48, marginBottom: 24 }}>🎬</span>
    <span
      style={{
        color: theme.colors.text,
        fontSize: 32,
        fontFamily: theme.fonts.heading,
        fontWeight: 600,
      }}
    >
      {title ?? "Feature Scene"}
    </span>
    <span
      style={{
        color: theme.colors.textMuted,
        fontSize: 16,
        fontFamily: theme.fonts.mono,
        marginTop: 12,
      }}
    >
      Add a clip to see video here
    </span>
  </AbsoluteFill>
);

export const FeatureScene: React.FC<FeatureSceneProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade in/out
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Section title slide-in
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleSlide = interpolate(frame, [0, fps * 0.5], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.colors.background, opacity }}>
      {/* Video clip or placeholder */}
      {config.clip ? (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Video
            src={staticFile(config.clip)}
            playbackRate={config.clipSpeed ?? 1}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </AbsoluteFill>
      ) : (
        <ClipPlaceholder title={config.title} />
      )}

      {/* Section title bar */}
      {config.title && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px 40px",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
            opacity: titleOpacity,
            transform: `translateY(${titleSlide}px)`,
          }}
        >
          <span
            style={{
              color: theme.colors.primary,
              fontSize: 18,
              fontFamily: theme.fonts.mono,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {config.title}
          </span>
        </div>
      )}

      {/* Annotations */}
      {config.annotations?.map((ann, i) => (
        <Annotation
          key={i}
          text={ann.text}
          position={ann.position}
          showAt={Math.round(ann.atSecond * fps)}
          duration={Math.round((ann.duration ?? 4) * fps)}
        />
      ))}
    </AbsoluteFill>
  );
};
