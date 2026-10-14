/** Inline SVG icon set (pengganti emoji di seluruh UI).
 * Local-first: tanpa dependensi, tanpa font/CDN — selalu tersedia offline.
 * Gaya stroke 24px ala Lucide, mengikuti warna teks via `currentColor`.
 */
import type { ReactNode } from "react";

export type IconName =
  | "chat" | "bell" | "bellOff" | "task" | "note" | "timer" | "clock"
  | "calendar" | "moonStar" | "sun" | "moon" | "settings" | "sliders"
  | "check" | "checkCircle" | "x" | "xCircle" | "plus"
  | "download" | "upload" | "zap" | "move" | "moveX"
  | "zoomIn" | "zoomOut" | "rotate" | "pin" | "activity"
  | "eyeOff" | "power" | "info" | "volume" | "hourglass"
  | "history" | "trash" | "chevronDown" | "star";

const P: Record<IconName, ReactNode> = {
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  bellOff: <><path d="M8.7 3A6 6 0 0 1 18 8c0 4 1.2 5.6 2.1 6.6M6.2 6.2C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h14" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><line x1="2" y1="2" x2="22" y2="22" /></>,
  task: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m9 12 2 2 4-4" /></>,
  note: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  timer: <><line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
  moonStar: <g fill="currentColor" stroke="none"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /><path d="M19 3.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" /></g>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.3 17.7-1.4 1.4" /><path d="m19.1 4.9-1.4 1.4" /></>,
  moon: <path fill="currentColor" stroke="none" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.9 4.9 2.1 2.1" /><path d="m17 17 2.1 2.1" /><path d="m19.1 4.9-2.1 2.1" /><path d="m7 17-2.1 2.1" /></>,
  sliders: <><path d="M21 4h-7" /><path d="M10 4H3" /><path d="M21 12h-9" /><path d="M8 12H3" /><path d="M21 20h-5" /><path d="M12 20H3" /><path d="M14 2v4" /><path d="M8 10v4" /><path d="M16 18v4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  xCircle: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  move: <><path d="M12 2v20" /><path d="M2 12h20" /><path d="m5 9-3 3 3 3" /><path d="m9 5 3-3 3 3" /><path d="m15 19-3 3-3-3" /><path d="m19 9 3 3-3 3" /></>,
  moveX: <><path d="M18 8 22 12l-4 4" /><path d="M2 12h20" /><path d="m6 8-4 4 4 4" /></>,
  zoomIn: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></>,
  zoomOut: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6" /></>,
  rotate: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  pin: <><path d="M9 4h6l1 7 3 3v2H5v-2l3-3z" /><path d="M12 16v5" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a17.6 17.6 0 0 1-2.16 3.19" /><path d="M6.61 6.61A17.5 17.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></>,
  power: <><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a9 9 0 0 1 0 14" /></>,
  hourglass: <><path d="M6 2h12" /><path d="M6 22h12" /><path d="M8 2v4l4 4 4-4V2" /><path d="M8 22v-4l4-4 4 4v4" /></>,
  history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  star: <path fill="currentColor" stroke="none" d="M12 2l2.9 6.26 6.6 1.04-4.75 4.87L17.8 21 12 17.77 6.2 21l1.05-6.83L2.5 9.3l6.6-1.04z" />,
};

export const ICON_NAMES = Object.keys(P) as IconName[];

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <span className="dp-icon" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {P[name]}
      </svg>
    </span>
  );
}
