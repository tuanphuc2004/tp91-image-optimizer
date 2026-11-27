import { describe, expect, it } from "vitest";
import {
  buildOutputFileName,
  computeSavingsPercent,
  computeTargetPlacement,
  crc32,
  createStoreZip,
  formatBytes,
} from "@/lib/image-tools";

describe("image-tools helpers", () => {
  it("computes cover crop placement for OG Image 1200x630 without distortion", () => {
    // 1000x1000 square source into 1200x630 cover frame -> scale 1.2 => 1200x1200 centered vertically
    const placement = computeTargetPlacement(1000, 1000, {
      targetWidth: 1200,
      targetHeight: 630,
      fitMode: "cover",
    });

    expect(placement.canvasWidth).toBe(1200);
    expect(placement.canvasHeight).toBe(630);
    expect(placement.drawWidth).toBe(1200);
    expect(placement.drawHeight).toBe(1200);
    expect(placement.drawX).toBe(0);
    expect(placement.drawY).toBe(-285);
  });

  it("computes contain placement inside 1200x630 preserving full aspect ratio", () => {
    // 1000x1000 square source inside 1200x630 contain frame -> scale 0.63 => 630x630 centered horizontally
    const placement = computeTargetPlacement(1000, 1000, {
      targetWidth: 1200,
      targetHeight: 630,
      fitMode: "contain",
    });

    expect(placement.canvasWidth).toBe(1200);
    expect(placement.canvasHeight).toBe(630);
    expect(placement.drawWidth).toBe(630);
    expect(placement.drawHeight).toBe(630);
    expect(placement.drawX).toBe(285);
    expect(placement.drawY).toBe(0);
  });

  it("respects max-width without upscaling small images", () => {
    const small = computeTargetPlacement(800, 600, {
      targetWidth: 1600,
      targetHeight: null,
      fitMode: "max-width",
      allowUpscale: false,
    });
    expect(small).toEqual({
      canvasWidth: 800,
      canvasHeight: 600,
      drawX: 0,
      drawY: 0,
      drawWidth: 800,
      drawHeight: 600,
    });

    const large = computeTargetPlacement(3200, 1600, {
      targetWidth: 1600,
      targetHeight: null,
      fitMode: "max-width",
      allowUpscale: false,
    });
    expect(large.canvasWidth).toBe(1600);
    expect(large.canvasHeight).toBe(800);
  });

  it("formats bytes and savings percentage cleanly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(15360)).toBe("15.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
    expect(computeSavingsPercent(1000, 250)).toBe(75);
    expect(buildOutputFileName("my photo.png", "image/webp", "-og")).toBe(
      "my photo-og.webp"
    );
  });

  it("creates valid STORE ZIP archive with deduplicated filenames and standard CRC32", () => {
    const sample = new TextEncoder().encode("123456789");
    expect(crc32(sample)).toBe(0xcbf43926);

    const zip = createStoreZip([
      { name: "banner.webp", data: new Uint8Array([1, 2, 3]) },
      { name: "banner.webp", data: new Uint8Array([4, 5, 6]) },
    ]);

    const view = new DataView(zip.buffer);
    // Local file header signature PK\x03\x04
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // End of central directory signature PK\x05\x06 at end - 22
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    // Entry count in EOCD = 2
    expect(view.getUint16(zip.length - 14, true)).toBe(2);

    const text = new TextDecoder().decode(zip);
    expect(text).toContain("banner.webp");
    expect(text).toContain("banner-2.webp");
  });
});
