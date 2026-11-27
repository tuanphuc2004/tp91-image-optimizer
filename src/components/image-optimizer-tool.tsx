"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  Copy,
  Download,
  Eye,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IMAGE_PRESETS,
  type ImageFitMode,
  type ImageOutputFormat,
  type ImagePresetId,
  buildOutputFileName,
  computeSavingsPercent,
  computeTargetPlacement,
  createStoreZip,
  formatBytes,
  getExtensionForFormat,
} from "@/lib/image-tools";
import { cn } from "@/lib/utils";

type ContainBackground = "white" | "dark" | "transparent";
type WatermarkPosition = "bottom-right" | "center";

interface ProcessSettings {
  presetId: ImagePresetId;
  customWidth: number;
  customHeight: number;
  fitMode: ImageFitMode;
  format: ImageOutputFormat;
  quality: number;
  containBg: ContainBackground;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number;
}

interface ImageQueueItem {
  id: string;
  file: File;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  outputUrl: string | null;
  outputBlob: Blob | null;
  outputWidth: number;
  outputHeight: number;
  outputName: string;
  processing: boolean;
  error: string | null;
}

const MAX_FILES = 20;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không thể đọc dữ liệu ảnh."));
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const q = format === "image/png" ? undefined : Math.min(1, Math.max(0.1, quality / 100));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Trình duyệt không thể xuất định dạng này."));
          return;
        }
        resolve(blob);
      },
      format,
      q
    );
  });
}

async function renderProcessedImage(
  sourceUrl: string,
  originalName: string,
  settings: ProcessSettings
): Promise<{
  blob: Blob;
  url: string;
  srcWidth: number;
  srcHeight: number;
  outWidth: number;
  outHeight: number;
  outputName: string;
}> {
  const img = await loadImageElement(sourceUrl);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  const preset = IMAGE_PRESETS.find((p) => p.id === settings.presetId) ?? IMAGE_PRESETS[0];

  const targetWidth =
    settings.presetId === "custom" ? settings.customWidth : preset.width;
  const targetHeight =
    settings.presetId === "custom" ? settings.customHeight : preset.height;
  const fitMode =
    settings.presetId === "custom" ? settings.fitMode : preset.fitMode;

  const placement = computeTargetPlacement(srcWidth, srcHeight, {
    targetWidth,
    targetHeight,
    fitMode,
    allowUpscale: settings.presetId !== "max-width-1600",
  });

  const canvas = document.createElement("canvas");
  canvas.width = placement.canvasWidth;
  canvas.height = placement.canvasHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ Canvas 2D.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const needsOpaqueBg =
    settings.format === "image/jpeg" ||
    (fitMode === "contain" && settings.containBg !== "transparent");

  if (needsOpaqueBg) {
    ctx.fillStyle =
      fitMode === "contain" && settings.containBg === "dark"
        ? "#0f172a"
        : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    img,
    placement.drawX,
    placement.drawY,
    placement.drawWidth,
    placement.drawHeight
  );

  if (settings.watermarkEnabled && settings.watermarkText.trim().length > 0) {
    const label = settings.watermarkText.trim();
    const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    ctx.save();
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.globalAlpha = Math.min(0.9, Math.max(0.1, settings.watermarkOpacity / 100));

    const padding = Math.max(16, Math.round(fontSize * 0.8));
    if (settings.watermarkPosition === "center") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
      ctx.fillText(label, canvas.width / 2 + 1, canvas.height / 2 + 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    } else {
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
      ctx.fillText(label, canvas.width - padding + 1, canvas.height - padding + 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, canvas.width - padding, canvas.height - padding);
    }
    ctx.restore();
  }

  const blob = await canvasToBlob(canvas, settings.format, settings.quality);
  const url = URL.createObjectURL(blob);
  const suffix =
    settings.presetId === "og-1200x630"
      ? "-og"
      : settings.presetId === "original"
        ? ""
        : `-${placement.canvasWidth}x${placement.canvasHeight}`;

  return {
    blob,
    url,
    srcWidth,
    srcHeight,
    outWidth: placement.canvasWidth,
    outHeight: placement.canvasHeight,
    outputName: buildOutputFileName(originalName, settings.format, suffix),
  };
}

export function ImageOptimizerTool() {
  const [settings, setSettings] = useState<ProcessSettings>({
    presetId: "og-1200x630",
    customWidth: 1200,
    customHeight: 630,
    fitMode: "cover",
    format: "image/webp",
    quality: 82,
    containBg: "white",
    watermarkEnabled: false,
    watermarkText: "TP91tool",
    watermarkPosition: "bottom-right",
    watermarkOpacity: 45,
  });

  const [items, setItems] = useState<ImageQueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [copiedOg, setCopiedOg] = useState(false);
  const [previewItem, setPreviewItem] = useState<ImageQueueItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ImageQueueItem[]>([]);
  const settingsRef = useRef<ProcessSettings>(settings);
  const processGenerationRef = useRef(0);

  itemsRef.current = items;
  settingsRef.current = settings;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      }
    };
  }, []);

  const processSingleItem = useCallback(
    async (id: string, sourceUrl: string, fileName: string, activeSettings: ProcessSettings, generation: number) => {
      try {
        const result = await renderProcessedImage(sourceUrl, fileName, activeSettings);
        if (generation !== processGenerationRef.current) {
          URL.revokeObjectURL(result.url);
          return;
        }
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
            return {
              ...item,
              originalWidth: result.srcWidth,
              originalHeight: result.srcHeight,
              outputUrl: result.url,
              outputBlob: result.blob,
              outputWidth: result.outWidth,
              outputHeight: result.outHeight,
              outputName: result.outputName,
              processing: false,
              error: null,
            };
          })
        );
      } catch (err) {
        if (generation !== processGenerationRef.current) return;
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  processing: false,
                  error: err instanceof Error ? err.message : "Lỗi xử lý ảnh.",
                }
              : item
          )
        );
      }
    },
    []
  );

  const reprocessAll = useCallback(
    (nextSettings: ProcessSettings) => {
      const current = itemsRef.current;
      if (current.length === 0) return;

      const generation = ++processGenerationRef.current;
      setItems((prev) => prev.map((item) => ({ ...item, processing: true, error: null })));

      for (const item of current) {
        void processSingleItem(
          item.id,
          item.originalUrl,
          item.file.name,
          nextSettings,
          generation
        );
      }
    },
    [processSingleItem]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reprocessAll(settings);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [settings, reprocessAll]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setNotice(null);
      const list = Array.from(incoming);
      const currentCount = itemsRef.current.length;
      const availableSlots = MAX_FILES - currentCount;

      if (availableSlots <= 0) {
        setNotice(`Mỗi lượt tối đa ${MAX_FILES} ảnh để trình duyệt chạy mượt.`);
        return;
      }

      const accepted: ImageQueueItem[] = [];
      let skipped = 0;

      for (const file of list.slice(0, availableSlots)) {
        if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE_BYTES) {
          skipped++;
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          originalUrl: URL.createObjectURL(file),
          originalWidth: 0,
          originalHeight: 0,
          outputUrl: null,
          outputBlob: null,
          outputWidth: 0,
          outputHeight: 0,
          outputName: buildOutputFileName(file.name, settingsRef.current.format),
          processing: true,
          error: null,
        });
      }

      if (list.length > availableSlots || skipped > 0) {
        setNotice(
          `Đã thêm ${accepted.length} ảnh. Một số tệp bị bỏ qua do không phải ảnh, vượt 25MB hoặc quá giới hạn ${MAX_FILES} ảnh.`
        );
      }

      if (accepted.length === 0) return;

      const generation = processGenerationRef.current;
      setItems((prev) => [...prev, ...accepted]);

      for (const item of accepted) {
        void processSingleItem(
          item.id,
          item.originalUrl,
          item.file.name,
          settingsRef.current,
          generation
        );
      }
    },
    [processSingleItem]
  );

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const files: File[] = [];
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      for (const entry of Array.from(clipItems)) {
        if (entry.type.startsWith("image/")) {
          const file = entry.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        addFiles(files);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.outputUrl) URL.revokeObjectURL(target.outputUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
    if (previewItem?.id === id) {
      setPreviewItem(null);
    }
  }

  function clearAll() {
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    setItems([]);
    setPreviewItem(null);
    setNotice(null);
  }

  function downloadSingle(item: ImageQueueItem) {
    if (!item.outputUrl) return;
    const link = document.createElement("a");
    link.href = item.outputUrl;
    link.download = item.outputName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadAllZip() {
    const ready = items.filter((item) => item.outputBlob !== null);
    if (ready.length === 0) return;
    if (ready.length === 1) {
      downloadSingle(ready[0]);
      return;
    }

    setZipping(true);
    try {
      const entries = await Promise.all(
        ready.map(async (item) => ({
          name: item.outputName,
          data: new Uint8Array(await item.outputBlob!.arrayBuffer()),
        }))
      );
      const zipBytes = createStoreZip(entries);
      const zipBuffer = new Uint8Array(zipBytes).buffer;
      const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = `tp91-images-${getExtensionForFormat(settings.format)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(zipUrl), 1500);
    } finally {
      setZipping(false);
    }
  }

  async function copyOgSnippet() {
    const snippet = `<meta property="og:image" content="https://your-domain.com/og-image.${getExtensionForFormat(settings.format)}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />`;
    await navigator.clipboard.writeText(snippet);
    setCopiedOg(true);
    window.setTimeout(() => setCopiedOg(false), 1800);
  }

  const stats = useMemo(() => {
    const completed = items.filter((i) => i.outputBlob !== null);
    const totalOriginal = completed.reduce((acc, i) => acc + i.file.size, 0);
    const totalOutput = completed.reduce(
      (acc, i) => acc + (i.outputBlob?.size ?? 0),
      0
    );
    return {
      readyCount: completed.length,
      totalOriginal,
      totalOutput,
      savedPercent: computeSavingsPercent(totalOriginal, totalOutput),
    };
  }, [items]);

  const activePreset =
    IMAGE_PRESETS.find((p) => p.id === settings.presetId) ?? IMAGE_PRESETS[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Settings Panel */}
      <aside className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Cấu hình nén & kích thước
            </h2>
          </div>
          <Badge variant="secondary" className="text-xs">
            0đ • Client-side
          </Badge>
        </div>

        {/* Presets */}
        <div className="space-y-2.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            1. Chọn chuẩn kích thước
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {IMAGE_PRESETS.map((preset) => {
              const active = settings.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      presetId: preset.id,
                    }))
                  }
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer",
                    active
                      ? "border-primary bg-accent/60 shadow-xs"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {preset.label}
                    </span>
                    <Badge
                      variant={active ? "default" : "secondary"}
                      className="text-[11px] font-medium shrink-0"
                    >
                      {preset.badge}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Size Inputs */}
        {settings.presetId === "custom" && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="img-custom-w" className="text-xs">
                  Chiều rộng (px)
                </Label>
                <Input
                  id="img-custom-w"
                  type="number"
                  min={16}
                  max={4096}
                  value={settings.customWidth}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customWidth: Math.max(16, Number(e.target.value) || 16),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="img-custom-h" className="text-xs">
                  Chiều cao (px)
                </Label>
                <Input
                  id="img-custom-h"
                  type="number"
                  min={16}
                  max={4096}
                  value={settings.customHeight}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customHeight: Math.max(16, Number(e.target.value) || 16),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="img-fit-mode" className="text-xs">
                Cách đặt ảnh vào khung
              </Label>
              <Select
                value={settings.fitMode}
                onValueChange={(v) =>
                  setSettings((prev) => ({ ...prev, fitMode: v as ImageFitMode }))
                }
              >
                <SelectTrigger id="img-fit-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover (Cắt vừa khung trung tâm)</SelectItem>
                  <SelectItem value="contain">Contain (Giữ toàn bộ ảnh)</SelectItem>
                  <SelectItem value="max-width">Thu nhỏ giữ nguyên tỉ lệ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Format & Quality */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="img-format" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Định dạng xuất
            </Label>
            <Select
              value={settings.format}
              onValueChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  format: v as ImageOutputFormat,
                }))
              }
            >
              <SelectTrigger id="img-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image/webp">WebP (Nhẹ nhất cho Web)</SelectItem>
                <SelectItem value="image/jpeg">JPEG (Tương thích cao)</SelectItem>
                <SelectItem value="image/png">PNG (Không mất nét)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label htmlFor="img-quality" className="font-semibold uppercase tracking-wide text-muted-foreground">
                Chất lượng
              </Label>
              <span className="font-mono font-semibold text-foreground">
                {settings.format === "image/png" ? "Lossless" : `${settings.quality}%`}
              </span>
            </div>
            <input
              id="img-quality"
              type="range"
              min={15}
              max={100}
              step={1}
              disabled={settings.format === "image/png"}
              value={settings.quality}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  quality: Number(e.target.value),
                }))
              }
              className="mt-2 h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
        </div>

        {/* Contain background when applicable */}
        {(settings.presetId === "custom" && settings.fitMode === "contain") && (
          <div className="space-y-1.5">
            <Label htmlFor="img-contain-bg" className="text-xs">
              Màu nền khoảng trống (Contain)
            </Label>
            <Select
              value={settings.containBg}
              onValueChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  containBg: v as ContainBackground,
                }))
              }
            >
              <SelectTrigger id="img-contain-bg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white">Nền trắng (#FFFFFF)</SelectItem>
                <SelectItem value="dark">Nền tối (#0F172A)</SelectItem>
                {settings.format !== "image/jpeg" && (
                  <SelectItem value="transparent">Trong suốt (Transparent)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Watermark */}
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="img-watermark-toggle"
              className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"
            >
              <input
                id="img-watermark-toggle"
                type="checkbox"
                checked={settings.watermarkEnabled}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    watermarkEnabled: e.target.checked,
                  }))
                }
                className="size-4 rounded border-border accent-primary"
              />
              Đóng dấu chữ (Watermark)
            </label>
            <Sparkles className="size-4 text-primary" />
          </div>

          {settings.watermarkEnabled && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="img-watermark-text" className="text-xs">
                  Nội dung chữ đóng dấu
                </Label>
                <Input
                  id="img-watermark-text"
                  maxLength={40}
                  placeholder="Ví dụ: TP91tool.vn"
                  value={settings.watermarkText}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      watermarkText: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="img-watermark-pos" className="text-xs">
                    Vị trí
                  </Label>
                  <Select
                    value={settings.watermarkPosition}
                    onValueChange={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        watermarkPosition: v as WatermarkPosition,
                      }))
                    }
                  >
                    <SelectTrigger id="img-watermark-pos">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Góc dưới phải</SelectItem>
                      <SelectItem value="center">Giữa ảnh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="img-watermark-opacity">Độ đậm</Label>
                    <span className="font-mono">{settings.watermarkOpacity}%</span>
                  </div>
                  <input
                    id="img-watermark-opacity"
                    type="range"
                    min={15}
                    max={85}
                    value={settings.watermarkOpacity}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        watermarkOpacity: Number(e.target.value),
                      }))
                    }
                    className="mt-2 h-2 w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OG Meta snippet helper */}
        {settings.presetId === "og-1200x630" && (
          <div className="space-y-2 rounded-xl border border-border bg-accent/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                Thẻ HTML gợi ý cho OG Image
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={copyOgSnippet}
              >
                {copiedOg ? (
                  <>
                    <Check className="size-3.5 text-primary" />
                    Đã copy
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy meta
                  </>
                )}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-card p-2.5 text-[11px] leading-relaxed text-muted-foreground font-mono">
              {`<meta property="og:image" content="https://domain.com/og.${getExtensionForFormat(settings.format)}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />`}
            </pre>
          </div>
        )}
      </aside>

      {/* Dropzone & Results */}
      <div className="space-y-5 lg:col-span-7">
        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Khu vực chọn hoặc kéo thả ảnh"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) {
              addFiles(e.dataTransfer.files);
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all cursor-pointer",
            dragging
              ? "border-primary bg-accent/70"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                addFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />

          <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <ImagePlus className="size-6" />
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">
            Kéo thả ảnh vào đây, bấm để chọn hoặc dán (Ctrl + V)
          </p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Hỗ trợ PNG, JPG, WebP, GIF (tối đa {MAX_FILES} ảnh/lượt). Xử lý trực tiếp bằng Canvas trình duyệt, ảnh không tải lên server.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <ShieldCheck className="size-3.5 text-primary" />
              Bảo mật 100% trên máy bạn
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Đang chọn: {activePreset.label}
            </Badge>
          </div>
        </div>

        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {/* Summary Bar */}
        {items.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Đã xử lý {stats.readyCount}/{items.length} ảnh
              </p>
              <p className="text-xs text-muted-foreground">
                Tổng dung lượng:{" "}
                <span className="font-mono text-foreground">
                  {formatBytes(stats.totalOriginal)}
                </span>{" "}
                →{" "}
                <span className="font-mono font-semibold text-primary">
                  {formatBytes(stats.totalOutput)}
                </span>{" "}
                {stats.totalOriginal > 0 && (
                  <span
                    className={cn(
                      "font-semibold",
                      stats.savedPercent >= 0 ? "text-emerald-600" : "text-amber-600"
                    )}
                  >
                    ({stats.savedPercent >= 0 ? `giảm ${stats.savedPercent}%` : `tăng ${Math.abs(stats.savedPercent)}%`})
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => reprocessAll(settings)}
              >
                <RefreshCw className="size-3.5" />
                Nén lại
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
              >
                <Trash2 className="size-3.5" />
                Xóa hết
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={stats.readyCount === 0 || zipping}
                onClick={downloadAllZip}
              >
                {zipping ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : stats.readyCount > 1 ? (
                  <Archive className="size-3.5" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {stats.readyCount > 1 ? "Tải tất cả (.zip)" : "Tải ảnh"}
              </Button>
            </div>
          </div>
        )}

        {/* Queue List */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => {
              const outSize = item.outputBlob?.size ?? 0;
              const saved = item.outputBlob
                ? computeSavingsPercent(item.file.size, outSize)
                : 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.outputUrl ?? item.originalUrl}
                        alt={item.outputName}
                        className="size-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.outputName}
                      </p>

                      {item.processing ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                          Đang xử lý trên trình duyệt...
                        </div>
                      ) : item.error ? (
                        <p className="text-xs text-destructive">{item.error}</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">
                            {item.originalWidth}×{item.originalHeight} →{" "}
                            <strong className="text-foreground">
                              {item.outputWidth}×{item.outputHeight}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            {formatBytes(item.file.size)} →{" "}
                            <strong className="text-foreground">
                              {formatBytes(outSize)}
                            </strong>
                          </span>
                          <Badge
                            variant={saved >= 0 ? "secondary" : "outline"}
                            className={cn(
                              "text-[11px] font-semibold",
                              saved > 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : saved < 0
                                  ? "text-amber-700 border-amber-200"
                                  : ""
                            )}
                          >
                            {saved >= 0 ? `-${saved}%` : `+${Math.abs(saved)}%`}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!item.outputUrl || item.processing}
                      onClick={() => setPreviewItem(item)}
                    >
                      <Eye className="size-3.5" />
                      So sánh
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!item.outputUrl || item.processing}
                      onClick={() => downloadSingle(item)}
                    >
                      <Download className="size-3.5" />
                      Tải
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xóa ${item.file.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-xs text-muted-foreground">
            Chưa có ảnh nào trong hàng đợi. Hãy thả ảnh vào khung phía trên để xem ngay mức dung lượng tiết kiệm được.
          </div>
        )}
      </div>

      {/* Before / After Comparison Dialog */}
      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              So sánh Trước / Sau — {previewItem?.outputName}
            </DialogTitle>
            <DialogDescription>
              {previewItem && previewItem.outputBlob
                ? `Ảnh gốc ${previewItem.originalWidth}×${previewItem.originalHeight} (${formatBytes(previewItem.file.size)}) → Sau xử lý ${previewItem.outputWidth}×${previewItem.outputHeight} (${formatBytes(previewItem.outputBlob.size)})`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {previewItem && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Ảnh gốc</span>
                  <span className="font-mono">{formatBytes(previewItem.file.size)}</span>
                </div>
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewItem.originalUrl}
                    alt="Ảnh gốc"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span>Sau nén ({getExtensionForFormat(settings.format).toUpperCase()})</span>
                  <span className="font-mono text-primary">
                    {previewItem.outputBlob
                      ? formatBytes(previewItem.outputBlob.size)
                      : "..."}
                  </span>
                </div>
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50 p-2">
                  {previewItem.outputUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewItem.outputUrl}
                      alt="Ảnh sau xử lý"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
