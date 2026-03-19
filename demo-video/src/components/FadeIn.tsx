import { interpolate, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  /** Delay before fade starts (frames) */
  delay?: number;
  /** Fade duration (frames) */
  duration?: number;
  /** Also slide up by this many pixels */
  slideUp?: number;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 15,
  slideUp = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(
    frame,
    [delay, delay + duration],
    [slideUp, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};
