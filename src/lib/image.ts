"use client";

export interface PreparedFile {
  name: string;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
  data: string; // base64, no data: prefix
  bytes: number;
}

const MAX_EDGE = 2200;

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read the file"));
    r.readAsDataURL(blob);
  });
}

/**
 * Get a flyer page ready to send: PDFs pass through; photos are shrunk to at
 * most 2200 px on the long edge and re-encoded as JPEG, which keeps phone
 * photos well under upload limits while staying legible for price text.
 */
export async function prepareFlyerFile(file: Blob & { name?: string }): Promise<PreparedFile> {
  const name = file.name ?? "flyer";
  if (file.type === "application/pdf") {
    if (file.size > 10 * 1024 * 1024) throw new Error(`${name} is over 10 MB — save fewer pages.`);
    const url = await readAsDataURL(file);
    return { name, mime: "application/pdf", data: url.split(",")[1] ?? "", bytes: file.size };
  }
  if (!file.type.startsWith("image/")) throw new Error(`${name} isn't an image or PDF.`);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`Couldn't open ${name}. Try a JPG or PNG screenshot.`);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser can't process images.");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error(`Couldn't compress ${name}.`);
  const url = await readAsDataURL(blob);
  return { name, mime: "image/jpeg", data: url.split(",")[1] ?? "", bytes: blob.size };
}

/** Read an image the user copied (e.g. a flyer screenshot). Needs a tap to trigger. */
export async function readClipboardImage(): Promise<Blob | null> {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return item.getType(type);
  }
  return null;
}
