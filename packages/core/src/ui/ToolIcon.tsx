import type { ToolId } from "../document/types";

const size = 18;

export function ToolIcon({ id }: { id: ToolId }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "selectBox":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="14" height="12" rx="1" strokeDasharray="3 2" />
          <path d="M7 9h2M15 9h2M7 13h2M15 13h2" />
        </svg>
      );
    case "selectLasso":
      return (
        <svg {...common}>
          <path d="M7 8c2-3 8-3 10 1 2 4-1 8-5 8-3 0-6-2-6-5 0-1.5 1-2.5 2.5-2.5" />
          <circle cx="9.5" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "move":
      return (
        <svg {...common}>
          <path d="M12 3v18M3 12h18" />
          <path d="M12 3l-2.5 3M12 3l2.5 3M12 21l-2.5-3M12 21l2.5-3M3 12l3-2.5M3 12l3 2.5M21 12l-3-2.5M21 12l-3 2.5" />
        </svg>
      );
    case "pen":
      return (
        <svg {...common}>
          <path d="M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z" />
          <path d="M12.5 6.5l5 5" />
        </svg>
      );
    case "eraser":
      return (
        <svg {...common}>
          <path d="M16 4l4 4-10 10H6l-2-2L16 4z" />
          <path d="M8 18h10" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <path d="M5 19L19 5" />
          <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "rect":
      return (
        <svg {...common}>
          <rect x="5" y="6" width="14" height="12" rx="1" />
        </svg>
      );
    case "ellipse":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="8" ry="5.5" />
        </svg>
      );
    default:
      return null;
  }
}
