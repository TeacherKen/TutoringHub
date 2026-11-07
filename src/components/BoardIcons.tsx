// ✏️ Simple line icons for the smart slides toolbar, drawn the same way as the menu icons
// (emoji looked different on every device, and some didn't say what the tool does).

const svg = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export type BoardIconName =
  | "select"
  | "pen"
  | "hl"
  | "line"
  | "rect"
  | "text"
  | "eraser"
  | "pointer"
  | "prev"
  | "next"
  | "pages"
  | "undo"
  | "redo"
  | "trash"
  | "timer"
  | "full"
  | "smaller";

const PATHS: Record<BoardIconName, React.ReactNode> = {
  // Move: four arrows
  select: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
    </>
  ),
  // Pen
  pen: (
    <>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      <path d="m14.5 5.5 3 3" />
    </>
  ),
  // Highlighter: a marker with a thick stroke under it
  hl: (
    <>
      <path d="m15 4 5 5-7.5 7.5H8V12z" />
      <path d="M8 16.5 6.5 18" />
      <path d="M4 21h9" strokeWidth={3.2} opacity={0.55} />
    </>
  ),
  line: <path d="M5 19 19 5" />,
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  // Text: a capital T
  text: (
    <>
      <path d="M5 6V4h14v2" />
      <path d="M12 4v16M9 20h6" />
    </>
  ),
  // Eraser
  eraser: (
    <>
      <path d="m7 21-4.3-4.3a1.5 1.5 0 0 1 0-2.1L13.4 3.9a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L10.6 21z" />
      <path d="M21 21H7M8.5 9.5l6 6" />
    </>
  ),
  // Pointer: a laser dot with rings
  pointer: (
    <>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <circle cx="12" cy="12" r="6.5" opacity={0.6} />
      <circle cx="12" cy="12" r="10" opacity={0.3} />
    </>
  ),
  prev: <path d="m15 5-7 7 7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  pages: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M10 2h4" />
    </>
  ),
  full: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  smaller: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
};

export function BoardIcon({ name, size = 22 }: { name: BoardIconName; size?: number }) {
  return (
    <svg {...svg} width={size} height={size}>
      {PATHS[name]}
    </svg>
  );
}

/** Short words under the tool icons. */
export const TOOL_LABELS: Record<string, string> = {
  select: "Move",
  pen: "Pen",
  hl: "Marker",
  line: "Line",
  rect: "Box",
  text: "Text",
  eraser: "Eraser",
  pointer: "Point",
};
