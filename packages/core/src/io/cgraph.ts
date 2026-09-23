import type { DocumentModel } from "../document/types";
import { createEmptyDocument } from "../document/types";

export const CGRAPH_MIME = "application/x-crystallograph+json";
export const CGRAPH_EXT = ".cgraph";

export function serializeCgraph(doc: DocumentModel): string {
  return JSON.stringify(doc, null, 2);
}

export function parseCgraph(text: string): DocumentModel {
  const data = JSON.parse(text) as DocumentModel & { version: number };
  if (!data || !Array.isArray(data.layers)) {
    throw new Error("Invalid .cgraph file");
  }
  if (data.version !== 2) {
    throw new Error("请使用新建文档（当前格式为分数坐标 v2）");
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
