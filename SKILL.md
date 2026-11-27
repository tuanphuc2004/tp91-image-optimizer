---
name: tp91-image-optimizer
description: Browser-based zero-cost image compressor, WebP/JPEG/PNG converter, OG Image (1200x630) cropper, text watermarker, and pure-TypeScript ZIP packager using HTML5 Canvas API. Use when building, customizing, or integrating client-side image optimization and social OG image generation without server or API costs.
---

# TP91 Image Optimizer

Zero-server, 100% browser-side image processing tool built with Next.js App Router, React, Tailwind CSS v4, shadcn/ui, and HTML5 Canvas 2D.

## When to Use

- Adding a free (`/tools`) image compression and resizing utility to a Next.js or React web app.
- Generating `1200×630` OpenGraph (`og:image`) banners, `1280×720` thumbnails, or `1080×1080` square product images client-side.
- Applying text watermarks and bundling multiple processed images into a `.zip` download without backend storage or paid APIs.

## Key Files

- `src/lib/image-tools.ts` — Pure TypeScript utilities (testable in Node):
  - `IMAGE_PRESETS` (`original`, `og-1200x630`, `thumb-1280x720`, `square-1080`, `max-width-1600`, `custom`)
  - `computeTargetPlacement(srcWidth, srcHeight, options)` — aspect-safe `cover`, `contain`, and `max-width` geometry
  - `createStoreZip(entries)` — dependency-free STORE-method ZIP builder with CRC32 and filename deduplication
  - `formatBytes`, `computeSavingsPercent`, `buildOutputFileName`
- `src/components/image-optimizer-tool.tsx` — Client UI supporting drag-and-drop, multi-file select, clipboard paste (`Ctrl+V`), quality slider, watermark overlay, before/after comparison dialog, and single/ZIP download.
- `tests/image-tools.test.ts` — Vitest unit tests for geometry, formatting, CRC32, and ZIP archive output.

## Integration Guidelines

1. Keep image decoding and `<canvas>` rendering strictly client-side (`"use client"`) so zero file bytes hit server bandwidth.
2. Always revoke created object URLs (`URL.revokeObjectURL`) when replacing, removing, or unmounting queue items to prevent browser memory leaks.
3. Enforce safe batch limits (`MAX_FILES = 20`, `MAX_FILE_SIZE_BYTES = 25MB`) to keep browser tabs responsive.
4. When using `image/jpeg` or `contain` mode with opaque background, fill canvas background before calling `ctx.drawImage`.

## Verification

```bash
npm test
npm run lint
npm run build
```
