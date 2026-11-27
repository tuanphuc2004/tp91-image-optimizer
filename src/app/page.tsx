import { Image as ImageIcon, ShieldCheck, Zap } from "lucide-react";
import { ImageOptimizerTool } from "@/components/image-optimizer-tool";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-col justify-between gap-4 border-b border-border pb-8 lg:flex-row lg:items-end">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <ImageIcon className="size-3.5 text-primary" />
              TP91 Image Optimizer
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              100% Client-side • 0đ Server
            </Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Nén & Chỉnh kích thước ảnh (WebP / OG Image)
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tối ưu dung lượng ảnh trước khi đăng lên website, tạo ảnh chia sẻ Facebook/Zalo chuẩn{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
              1200×630
            </code>{" "}
            và đóng dấu watermark hàng loạt ngay trên trình duyệt.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Zap className="size-4 text-primary" />
          <span>Không giới hạn lượt • Tải ZIP nhiều ảnh</span>
        </div>
      </div>

      <ImageOptimizerTool />
    </main>
  );
}
