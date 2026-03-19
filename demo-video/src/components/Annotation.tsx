import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnnotationPosition } from "../demo.config";
import { theme } from "../lib/theme";

interface AnnotationProps {
  text: string;
  position: AnnotationPosition;
  showAt: number;
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
  const { fps } = useVideoConfig();

  if (frame < showAt || frame > showAt + duration) return null;

  const localFrame = frame - showAt;

  // Spring entrance
  const entrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 120 },
  });

  // Smooth exit
  const fadeOut = interpolate(
    localFrame,
    [duration - 15, duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const opacity = Math.min(entrance, fadeOut);
  const slideX = 25 * (1 - entrance);
  const scale = 0.95 + 0.05 * entrance;

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        opacity,
        transform:
          position === "center"
            ? `translate(-50%, -50%) translateX(${slideX}px) scale(${scale})`
            : `translateX(${slideX}px) scale(${scale})`,
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
