import type { DocumentModel } from "../document/types";
import { createEmptyDocument } from "../document/types";

export const CGRAPH_MIME = "application/x-crystallograph+json";
export const CGRAPH_EXT = ".cgraph";

export function serializeCgraph(doc: DocumentModel): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Error thrown when a `.cgraph` file cannot be opened. `code` is
 * language-neutral; the UI maps it to a translated message
 * (`error.cgraphInvalid` / `error.cgraphVersion`).
 */
export class CgraphError extends Error {
  constructor(public readonly code: "invalid" | "version") {
    super(
      code === "version"
        ? "Unsupported .cgraph version (expected fractional-coordinate v2)"
        : "Invalid .cgraph file",
    );
    this.name = "CgraphError";
  }
}

/*
 * Note on p3m1 / p31m: before the fix that made their generators follow ITA,
 * the app drew "p3m1" with the p31m operations and vice versa. Documents only
 * store the group id plus master strokes, and both old and new files are
 * version 2, so they cannot be told apart and are deliberately NOT migrated:
 * an old p3m1/p31m drawing now renders with the correct (ITA) group. To get
 * the old look back, select the other of the two groups — its generators are
 * exactly the ones the old build used.
 */
export function parseCgraph(text: string): DocumentModel {
  let data: DocumentModel & { version: number };
  try {
    data = JSON.parse(text) as DocumentModel & { version: number };
  } catch {
    throw new CgraphError("invalid");
  }
  if (!data || !Array.isArray(data.layers)) {
    throw new CgraphError("invalid");
  }
  if (data.version !== 2) {
    throw new CgraphError("version");
  }
  return data;
}

export function downloadCgraph(doc: DocumentModel, filename = "untitled.cgraph") {
  const blob = new Blob([serializeCgraph(doc)], { type: CGRAPH_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(CGRAPH_EXT) ? filename : `${filename}${CGRAPH_EXT}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openCgraphFromFile(file: File): Promise<DocumentModel> {
  const text = await file.text();
  return parseCgraph(text);
}

export { createEmptyDocument };
