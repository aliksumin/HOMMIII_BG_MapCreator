// Browser image helpers: load, rasterise, re-encode.

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Loads an image once; later calls share the same promise. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  let promise = cache.get(url);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${url}`));
      img.src = url;
    });
    cache.set(url, promise);
    promise.catch(() => cache.delete(url));
  }
  return promise;
}

/** Draws an image (SVG included) onto a canvas and returns a data URL. */
export async function rasterise(url: string, width: number, height?: number, mime = "image/png"): Promise<string> {
  const img = await loadImage(url);
  const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width) || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height ?? width * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, 0.9);
}

/** Reads an uploaded image, scales it to at most `max` pixels on its long side, and returns PNG data. */
export async function readImageFile(file: File, max: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a PNG, JPEG or WebP image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is larger than 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    return await rasterise(url, img.naturalWidth * scale, img.naturalHeight * scale);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Data URL to bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Saves bytes or text as a download. */
export function download(name: string, data: Blob | Uint8Array | string, type = "application/octet-stream"): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}