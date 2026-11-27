export type ImageOutputFormat = "image/webp" | "image/jpeg" | "image/png";

export type ImagePresetId =
  | "original"
  | "og-1200x630"
  | "thumb-1280x720"
  | "square-1080"
  | "max-width-1600"
  | "custom";

export type ImageFitMode = "cover" | "contain" | "max-width";

export interface ImagePreset {
  readonly id: ImagePresetId;
  readonly label: string;
  readonly badge: string;
  readonly description: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly fitMode: ImageFitMode;
}

export const IMAGE_PRESETS: readonly ImagePreset[] = [
  {
    id: "original",
    label: "Giữ kích thước gốc",
    badge: "Nén dung lượng",
    description: "Giữ nguyên chiều rộng & cao, chỉ chuyển định dạng và tối ưu dung lượng.",
    width: null,
    height: null,
    fitMode: "max-width",
  },
  {
    id: "og-1200x630",
    label: "OG Image (1200 × 630)",
    badge: "Facebook / Zalo",
    description: "Chuẩn ảnh chia sẻ link website, OpenGraph & SEO (cắt vừa khung không méo).",
    width: 1200,
    height: 630,
    fitMode: "cover",
  },
  {
    id: "thumb-1280x720",
    label: "Thumbnail 16:9 (1280 × 720)",
    badge: "Video / Blog",
    description: "Khung HD 16:9 phù hợp ảnh bìa bài viết, YouTube và banner sản phẩm.",
    width: 1280,
    height: 720,
    fitMode: "cover",
  },
  {
    id: "square-1080",
    label: "Vuông 1:1 (1080 × 1080)",
    badge: "Shop / Social",
    description: "Ảnh vuông sắc nét cho ảnh đại diện, bài đăng mạng xã hội hoặc sản phẩm.",
    width: 1080,
    height: 1080,
    fitMode: "cover",
  },
  {
    id: "max-width-1600",
    label: "Tối đa ngang 1600px",
    badge: "Tối ưu Web",
    description: "Thu nhỏ ảnh quá lớn về tối đa 1600px, giữ đúng tỉ lệ khung hình gốc.",
    width: 1600,
    height: null,
    fitMode: "max-width",
  },
  {
    id: "custom",
    label: "Tùy chỉnh kích thước",
    badge: "Tự do",
    description: "Tự nhập chiều rộng, chiều cao và chọn kiểu cắt/đặt ảnh vào khung.",
    width: 1200,
    height: 630,
    fitMode: "cover",
  },
] as const;

export interface PlacementOptions {
  targetWidth: number | null;
  targetHeight: number | null;
  fitMode: ImageFitMode;
  allowUpscale?: boolean;
}

export interface CanvasPlacement {
  canvasWidth: number;
  canvasHeight: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}

export function computeTargetPlacement(
  srcWidth: number,
  srcHeight: number,
  options: PlacementOptions
): CanvasPlacement {
  const safeSrcW = Math.max(1, Math.round(srcWidth));
  const safeSrcH = Math.max(1, Math.round(srcHeight));
  const targetW =
    options.targetWidth && options.targetWidth > 0
      ? Math.round(options.targetWidth)
      : null;
  const targetH =
    options.targetHeight && options.targetHeight > 0
      ? Math.round(options.targetHeight)
      : null;

  if (!targetW && !targetH) {
    return {
      canvasWidth: safeSrcW,
      canvasHeight: safeSrcH,
      drawX: 0,
      drawY: 0,
      drawWidth: safeSrcW,
      drawHeight: safeSrcH,
    };
  }

  if (options.fitMode === "max-width" || !targetW || !targetH) {
    const scaleW = targetW ? targetW / safeSrcW : Infinity;
    const scaleH = targetH ? targetH / safeSrcH : Infinity;
    let scale = Math.min(scaleW, scaleH);
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (!options.allowUpscale && scale > 1) {
      scale = 1;
    }

    const outW = Math.max(1, Math.round(safeSrcW * scale));
    const outH = Math.max(1, Math.round(safeSrcH * scale));
    return {
      canvasWidth: outW,
      canvasHeight: outH,
      drawX: 0,
      drawY: 0,
      drawWidth: outW,
      drawHeight: outH,
    };
  }

  if (options.fitMode === "cover") {
    const scale = Math.max(targetW / safeSrcW, targetH / safeSrcH);
    const drawW = Math.round(safeSrcW * scale);
    const drawH = Math.round(safeSrcH * scale);
    return {
      canvasWidth: targetW,
      canvasHeight: targetH,
      drawX: Math.round((targetW - drawW) / 2),
      drawY: Math.round((targetH - drawH) / 2),
      drawWidth: drawW,
      drawHeight: drawH,
    };
  }

  // contain
  const scale = Math.min(targetW / safeSrcW, targetH / safeSrcH);
  const drawW = Math.max(1, Math.round(safeSrcW * scale));
  const drawH = Math.max(1, Math.round(safeSrcH * scale));
  return {
    canvasWidth: targetW,
    canvasHeight: targetH,
    drawX: Math.round((targetW - drawW) / 2),
    drawY: Math.round((targetH - drawH) / 2),
    drawWidth: drawW,
    drawHeight: drawH,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function computeSavingsPercent(
  originalBytes: number,
  outputBytes: number
): number {
  if (originalBytes <= 0) return 0;
  return Math.round(((originalBytes - outputBytes) / originalBytes) * 100);
}

export function getExtensionForFormat(format: ImageOutputFormat): string {
  switch (format) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
  }
}

export function buildOutputFileName(
  originalName: string,
  format: ImageOutputFormat,
  suffix = ""
): string {
  const stripped = originalName.replace(/\.[^/.]+$/, "").trim() || "image";
  const safeBase = stripped.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  const ext = getExtensionForFormat(format);
  return `${safeBase}${suffix}.${ext}`;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deduplicateZipNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((rawName) => {
    const clean = rawName.replace(/^\/+/, "") || "file";
    const count = seen.get(clean) ?? 0;
    seen.set(clean, count + 1);
    if (count === 0) return clean;
    const dot = clean.lastIndexOf(".");
    if (dot > 0) {
      return `${clean.slice(0, dot)}-${count + 1}${clean.slice(dot)}`;
    }
    return `${clean}-${count + 1}`;
  });
}

/**
 * Pure TypeScript uncompressed (STORE) ZIP archive builder.
 * Ideal for WebP/JPEG/PNG images because they are already compressed,
 * keeping 0đ client-side packaging with zero third-party dependencies.
 */
export function createStoreZip(
  entries: ReadonlyArray<{ name: string; data: Uint8Array }>
): Uint8Array {
  const encoder = new TextEncoder();
  const uniqueNames = deduplicateZipNames(entries.map((e) => e.name));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry, index) => {
    const nameBytes = encoder.encode(uniqueNames[index]);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method 0 (STORE)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0x5421, true); // Mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalLength);
  let cursor = 0;

  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  output.set(eocd, cursor);

  return output;
}
