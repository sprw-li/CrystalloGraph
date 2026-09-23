import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function Hotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const s = useAppStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const step = 0.02;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        s.zoomBy(1.15);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        s.zoomBy(1 / 1.15);
        return;
      }
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        s.newDoc();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        s.copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        s.cutSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        s.pasteClipboard();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedIds.length) {
          e.preventDefault();
          s.deleteSelected();
        }
        return;
      }

      if (s.selectedIds.length) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          s.nudgeSelected(-step, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          s.nudgeSelected(step, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          s.nudgeSelected(0, -step);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          s.nudgeSelected(0, step);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
