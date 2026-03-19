import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TimelineMilestone } from "../demo.config";
import { theme } from "../lib/theme";

interface TimelineSceneProps {
  milestones: TimelineMilestone[];
}

// Grid positions: [row, col] for Z-path order (1→2 then 4←3)
const GRID_POSITIONS: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
];

const MilestoneCard: React.FC<{
  milestone: TimelineMilestone;
  progress: number;
}> = ({ milestone, progress }) => {
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(progress, [0, 0.3], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentColor = milestone.color ?? theme.colors.primary;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        background: theme.colors.surface,
        borderRadius: 16,
        padding: "24px 28px",
        borderLeft: `5px solid ${accentColor}`,
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Agent badge + date */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            background: accentColor,
            color: theme.colors.background,
            fontSize: 15,
            fontFamily: theme.fonts.mono,
            fontWeight: 700,
            padding: "4px 12px",
            borderRadius: 5,
            letterSpacing: 1,
          }}
        >
          {milestone.agent}
        </div>
        <span
          style={{
            color: theme.colors.textMuted,
            fontSize: 16,
            fontFamily: theme.fonts.mono,
          }}
        >
          {milestone.date}
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          color: theme.colors.text,
          fontSize: 26,
          fontFamily: theme.fonts.heading,
          fontWeight: 700,
          marginBottom: 16,
          lineHeight: 1.3,
        }}
      >
        {milestone.headline}
      </div>

      {/* Two-column body: metrics left, details right */}
      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Left column: metrics */}
        {milestone.metrics && milestone.metrics.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 110 }}>
            {milestone.metrics.map((metric, mi) => {
              const metricProgress = interpolate(
                progress,
                [0.15 + mi * 0.08, 0.35 + mi * 0.08],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return (
                <div
                  key={mi}
                  style={{
                    opacity: metricProgress,
                    transform: `scale(${interpolate(metricProgress, [0, 1], [0.8, 1])})`,
                    background: `${accentColor}15`,
                    border: `1px solid ${accentColor}30`,
                    borderRadius: 10,
                    padding: "10px 16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: accentColor,
                      fontSize: 28,
                      fontFamily: theme.fonts.heading,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {metric.value}
                  </div>
                  <div
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 13,
                      fontFamily: theme.fonts.mono,
                      lineHeight: 1.4,
                    }}
                  >
                    {metric.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Right column: details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {milestone.details.map((detail, di) => {
            const detailProgress = interpolate(
              progress,
              [0.2 + di * 0.1, 0.4 + di * 0.1],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={di}
                style={{
                  opacity: detailProgress,
                  transform: `translateX(${interpolate(detailProgress, [0, 1], [10, 0])}px)`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: accentColor,
                    fontSize: 28,
                    lineHeight: 2,
                    flexShrink: 0,
                  }}
                >
                  ▸
                </span>
                <span
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 28,
                    fontFamily: theme.fonts.body,
                    lineHeight: 2,
                  }}
                >
                  {detail}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech tags */}
      {milestone.tags && milestone.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {milestone.tags.map((tag, ti) => {
            const tagProgress = interpolate(
              progress,
              [0.5 + ti * 0.06, 0.65 + ti * 0.06],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <span
                key={ti}
                style={{
                  opacity: tagProgress,
                  background: `${accentColor}20`,
                  color: accentColor,
                  fontSize: 14,
                  fontFamily: theme.fonts.mono,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 5,
                  letterSpacing: 0.5,
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TimelineScene: React.FC<TimelineSceneProps> = ({ milestones }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

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

  const progress = frame / durationInFrames;
  const entryFractions = [0 / 61, 12.8 / 61, 26.6 / 61, 43.2 / 61];

  const lineProgress = interpolate(progress, [0.02, 0.85], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.colors.background,
        opacity: Math.min(fadeIn, fadeOut),
        padding: "36px 56px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
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
            Under the Hood
          </span>
          <span
            style={{
              color: theme.colors.text,
              fontSize: 32,
              fontFamily: theme.fonts.heading,
              fontWeight: 700,
            }}
          >
            The Agentic Builder Journey
          </span>
        </div>

        {/* Timeline bar */}
        <div
          style={{
            width: "100%",
            height: 3,
            background: theme.colors.surface,
            borderRadius: 2,
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${lineProgress}%`,
              height: "100%",
              background: theme.colors.primary,
              borderRadius: 2,
            }}
          />
          {milestones.slice(0, 4).map((_, i) => {
            const dotPos = ((i + 0.5) / Math.max(milestones.length, 1)) * 100;
            const dotProgress = interpolate(
              progress,
              [entryFractions[i] ?? 0, (entryFractions[i] ?? 0) + 0.05],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${dotPos}%`,
                  top: "50%",
                  transform: `translate(-50%, -50%) scale(${dotProgress})`,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: theme.colors.primary,
                  opacity: dotProgress,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 2×2 Grid — fills remaining space */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 20,
          minHeight: 0,
        }}
      >
        {milestones.slice(0, 4).map((ms, i) => {
          const [row, col] = GRID_POSITIONS[i];
          const cardProgress = interpolate(
            progress,
            [entryFractions[i] ?? 0, (entryFractions[i] ?? 0) + 0.18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
                minHeight: 0,
              }}
            >
              <MilestoneCard milestone={ms} progress={cardProgress} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
