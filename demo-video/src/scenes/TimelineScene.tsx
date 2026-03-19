import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../lib/theme";

export interface TimelineMilestone {
  agent: string;
  date: string;
  headline: string;
  details: string[];
  color?: string;
}

interface TimelineSceneProps {
  milestones: TimelineMilestone[];
}

/**
 * 2×2 grid layout with Z-path reading order and connecting path:
 *
 *   ┌───1───┐  →  ┌───2───┐
 *   └───────┘     └───┬───┘
 *                     │
 *   ┌───4───┐  ←  ┌───3───┐
 *   └───────┘     └───────┘
 */

// Grid positions: [row, col] for Z-path order
const GRID_POSITIONS: [number, number][] = [
  [0, 0], // 1: top-left
  [0, 1], // 2: top-right
  [1, 1], // 3: bottom-right
  [1, 0], // 4: bottom-left
];

const MilestoneCard: React.FC<{
  milestone: TimelineMilestone;
  progress: number; // 0→1 for this card's entrance
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
        borderRadius: 14,
        padding: "22px 26px",
        borderLeft: `4px solid ${accentColor}`,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Agent badge + date */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            display: "inline-block",
            background: accentColor,
            color: theme.colors.background,
            fontSize: 13,
            fontFamily: theme.fonts.mono,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 4,
            letterSpacing: 1,
          }}
        >
          {milestone.agent}
        </div>
        <span
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            fontFamily: theme.fonts.mono,
            letterSpacing: 0.5,
          }}
        >
          {milestone.date}
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          color: theme.colors.text,
          fontSize: 22,
          fontFamily: theme.fonts.heading,
          fontWeight: 600,
          marginBottom: 14,
          lineHeight: 1.3,
        }}
      >
        {milestone.headline}
      </div>

      {/* Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {milestone.details.map((detail, di) => {
          const detailProgress = interpolate(
            progress,
            [0.2 + di * 0.12, 0.4 + di * 0.12],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={di}
              style={{
                opacity: detailProgress,
                transform: `translateX(${interpolate(detailProgress, [0, 1], [12, 0])}px)`,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span
                style={{
                  color: accentColor,
                  fontSize: 14,
                  lineHeight: 1.6,
                  flexShrink: 0,
                }}
              >
                ▸
              </span>
              <span
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 16,
                  fontFamily: theme.fonts.body,
                  lineHeight: 1.6,
                }}
              >
                {detail}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TimelineScene: React.FC<TimelineSceneProps> = ({ milestones }) => {
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

  // Card entry times aligned to subtitle segments (fractions of total duration)
  // Subtitles: 0s, 12.8s, 26.6s, 43.2s out of 61s
  const entryFractions = [0 / 61, 12.8 / 61, 26.6 / 61, 43.2 / 61];
  const progress = frame / durationInFrames;

  // Connecting path segments progress
  // Path: card1 → card2 (horizontal top), card2 → card3 (vertical right), card3 → card4 (horizontal bottom)
  const pathSegments = [
    interpolate(progress, [entryFractions[0] + 0.05, entryFractions[1]], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(progress, [entryFractions[1] + 0.05, entryFractions[2]], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(progress, [entryFractions[2] + 0.05, entryFractions[3]], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  ];

  const gridGap = 28;
  const headerHeight = 100;

  return (
    <AbsoluteFill
      style={{
        background: theme.colors.background,
        opacity: Math.min(fadeIn, fadeOut),
        padding: "50px 70px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ height: headerHeight, flexShrink: 0 }}>
        <div
          style={{
            color: theme.colors.primary,
            fontSize: 18,
            fontFamily: theme.fonts.mono,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          Under the Hood
        </div>
        <div
          style={{
            color: theme.colors.text,
            fontSize: 34,
            fontFamily: theme.fonts.heading,
            fontWeight: 700,
          }}
        >
          The Agentic Builder Journey
        </div>
      </div>

      {/* 2×2 Grid with connecting path */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: gridGap,
          position: "relative",
        }}
      >
        {/* Connecting path SVG overlay */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {/* Path 1→2: horizontal line across top */}
          <line
            x1="50%"
            y1="25%"
            x2="50%"
            y2="25%"
            stroke={theme.colors.primary}
            strokeWidth={2}
            strokeDasharray={`${pathSegments[0]} ${100 - pathSegments[0]}`}
            pathLength={100}
            opacity={0.4}
          />
          {/* Path 2→3: vertical line down right side */}
          <line
            x1="75%"
            y1="50%"
            x2="75%"
            y2="50%"
            stroke={theme.colors.primary}
            strokeWidth={2}
            strokeDasharray={`${pathSegments[1]} ${100 - pathSegments[1]}`}
            pathLength={100}
            opacity={0.4}
          />
          {/* Path 3→4: horizontal line across bottom */}
          <line
            x1="50%"
            y1="75%"
            x2="50%"
            y2="75%"
            stroke={theme.colors.primary}
            strokeWidth={2}
            strokeDasharray={`${pathSegments[2]} ${100 - pathSegments[2]}`}
            pathLength={100}
            opacity={0.4}
          />
        </svg>

        {/* Cards in Z-path order */}
        {milestones.slice(0, 4).map((ms, i) => {
          const [row, col] = GRID_POSITIONS[i];
          const cardProgress = interpolate(
            progress,
            [entryFractions[i], entryFractions[i] + 0.15],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
                zIndex: 2,
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
