import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnnotationPosition } from "../demo.config";
import { theme } from "../lib/theme";

interface AnnotationProps {
  text: string;
  position: AnnotationPosition;
  /** Frame when this annotation appears (relative to scene start) */
  showAt: number;
  /** How many frames to show */
  duration: number;
}

const positionStyles: Record<AnnotationPosition, React.CSSProperties> = {
  "top-left": { top: 80, left: 80 },
  "top-right": { top: 80, right: 80 },
  "bottom-left": { bottom: 80, left: 80 },
  "bottom-right": { bottom: 80, right: 80 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export const Annotation: React.FC<AnnotationProps> = ({
  text,
  position,
  showAt,
  duration,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = 10;
  const fadeOut = 10;

  if (frame < showAt || frame > showAt + duration) return null;

  const localFrame = frame - showAt;
  const opacity = interpolate(
    localFrame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const slideX = interpolate(localFrame, [0, fadeIn], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        opacity,
        transform:
          position === "center"
            ? `translate(-50%, -50%) translateX(${slideX}px)`
            : `translateX(${slideX}px)`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "16px 24px",
          borderLeft: `3px solid ${theme.colors.primary}`,
          maxWidth: 500,
        }}
      >
        <span
          style={{
            color: theme.colors.text,
            fontSize: 28,
            fontFamily: theme.fonts.body,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
