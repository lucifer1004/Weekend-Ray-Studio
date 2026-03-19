import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  /** Delay before animation starts (frames) */
  delay?: number;
  /** Fade duration — kept for backward compat but ignored (spring-based now) */
  duration?: number;
  /** Also slide up by this many pixels */
  slideUp?: number;
  /** Spring damping (lower = more bounce, default 12) */
  damping?: number;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  slideUp = 0,
  damping = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping, mass: 0.8, stiffness: 120 },
  });

  const opacity = Math.max(0, progress);
  const translateY = slideUp * (1 - progress);

  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};
