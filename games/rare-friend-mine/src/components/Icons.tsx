import React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

// Shared inline-SVG shell. Sized via `1em` so existing icon classes that set
// font-size keep working; color is inherited through `currentColor`.
function Svg({ size, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size ?? "1em"}
      height={size ?? "1em"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CoinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 5v3M12 16v3" />
    </Svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c1 3-2 4.5-2 7a3.5 3.5 0 0 0 2 3.2c.6-.9 1-1.9 1-2.7 2 .9 4 2.9 4 5.5A5 5 0 0 1 12 21a5 5 0 0 1-5-5c0-3.5 3-4.6 5-13z" />
    </Svg>
  );
}

export function PickaxeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 6.5a4.5 4.5 0 0 0-6.4 6.4l-4 4a1.8 1.8 0 0 0 2.6 2.6l4-4a4.5 4.5 0 0 0 6.4-6.4l-2.6 1.5-2.5-2.5 1.5-2.6z" />
      <path d="M15.5 5.5L19 2" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.5V12l3.5 2" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 2.7v5.2c0 4.4-2.8 7.6-7 9.1-4.2-1.5-7-4.7-7-9.1V5.7L12 3z" />
    </Svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2L4.5 13.5H11L9.5 22 19.5 9.5H12.9L13 2z" />
    </Svg>
  );
}

export function RadarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M7 13a5 5 0 0 1 10 0" />
      <path d="M10 13a2 2 0 0 1 4 0" />
      <circle cx="12" cy="13" r="0.5" fill="currentColor" />
      <path d="M12 4V2M4.5 5L3 3.5M19.5 5L21 3.5" />
    </Svg>
  );
}

export function BombIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="13" r="7" />
      <path d="M16.5 8.5L19 6M21 3l1 1M18 3l1.6 1.6M12 6.5V4" />
      <path d="M13.5 8l.7-2.4" />
    </Svg>
  );
}

export function CloverIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 12v4M10.2 6.4a2.4 2.4 0 1 0-3.4-3.4C4.8 5 9.4 10.5 12 12c2.6-1.5 7.2-7 5.2-9a2.4 2.4 0 1 0-3.4 3.4" />
      <path d="M10.2 17.6a2.4 2.4 0 1 1-3.4 3.4C4.8 19 9.4 13.5 12 12c2.6 1.5 7.2 7 5.2 9a2.4 2.4 0 1 1-3.4-3.4" />
      <path d="M12 8.6a2.4 2.4 0 1 1 3.4-3.4c2 2-2.6 7.5-5.2 9 2.6 1.5 7.2 7 5.2 9a2.4 2.4 0 1 1-3.4-3.4" />
    </Svg>
  );
}

export function CursedEyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12" rx="8" ry="4.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 12l.5 6M12 6l.5 6M4 12h7M13 12h7" />
    </Svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 12 20a6 6 0 0 1-6-6.5C6 9.2 12 3 12 3z" />
    </Svg>
  );
}

export function CoinSplitIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h5M15.5 12h5" />
      <path d="M6 14.5L4.5 16M18 14.5L19.5 16" />
    </Svg>
  );
}

export function GemIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h10L21 9l-9 11.5L3 9l4-5.5z" />
      <path d="M3 9h18M9.5 3.5L8 9l4 11.5L16 9l-1.5-5.5M8 9h8" />
    </Svg>
  );
}

export function MoonOreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
      <circle cx="17" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CosmicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2l1.8 6.2L20 8l-4.6 3.4L18 17l-6-3.2L6 17l2.6-5.6L4 8l6.2-.2L12 2z" />
    </Svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7z" />
      <path d="M5 17h14" />
      <circle cx="8" cy="6" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function OrbIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M13.5 4.6A8 8 0 0 0 10.8 19.5M12 8.5a5 5 0 0 1 0 7" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function ResourceIcon({ id, ...props }: IconProps & { id: string }) {
  switch (id) {
    case "moon":
      return <MoonOreIcon {...props} />;
    case "cosmic":
      return <CosmicIcon {...props} />;
    case "golden":
      return <CrownIcon {...props} />;
    case "shadow":
      return <OrbIcon {...props} />;
    case "copper":
    default:
      return <GemIcon {...props} />;
  }
}

export function SparklesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l1.3 4.4L17.5 9l-4.2 2.6L15 16l-3-3.2L9 16l1.7-4.4L6.5 9l4.2-.6L12 4z" />
      <path d="M19 14l.7 2.3L22 17l-2.3 1.7L19 21l-.7-2.3L16 17l2.3-.7L19 14z" />
    </Svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5L21.5 20h-19L12 3.5z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.3" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.3 9a2.9 2.9 0 0 1 5.6 1c0 1.8-2.4 2-2.4 3.6" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function BankIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9.5L12 4l9 5.5" />
      <path d="M5 9.5V17M9.5 9.5V17M14.5 9.5V17M19 9.5V17" />
      <path d="M3 17h18" />
      <path d="M3 20h18" />
    </Svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H4.5v2a3.5 3.5 0 0 0 3.5 3.5M16 5h3.5v2A3.5 3.5 0 0 1 16 10.5" />
      <path d="M12 12v4M9 20h6M10 17h4l-1 3h-2l-1-3z" />
    </Svg>
  );
}

export function SmokeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="14" r="3.5" />
      <circle cx="13" cy="11" r="4.5" />
      <circle cx="17" cy="16" r="3" />
      <path d="M13 6.5V4M10 3.5v-1.5" />
    </Svg>
  );
}

export function ChestIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10h16v9H4z" />
      <path d="M4 10l2-4h12l2 4" />
      <path d="M12 6v5" />
      <circle cx="12" cy="12.8" r="1.4" />
      <path d="M9 19v-3M15 19v-3" />
    </Svg>
  );
}

export function SpeakerOnIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9v6h3l4 4V5L7 9H4z" />
      <path d="M15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" />
    </Svg>
  );
}

export function SpeakerOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9v6h3l4 4V5L7 9H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
    </Svg>
  );
}