import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

/** Skeleton generik untuk halaman berbasis tabel (produk, kategori). */
export function TablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bar className="h-6 w-40" />
          <Bar className="h-4 w-56" />
        </div>
        <Bar className="h-9 w-36" />
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <Bar className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Bar className="h-4 flex-1" />
              <Bar className="h-4 w-24" />
              <Bar className="h-8 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
