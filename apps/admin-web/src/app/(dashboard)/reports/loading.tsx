import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="py-6">
              <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
              <div className="mt-3 h-6 w-28 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="h-5 w-52 animate-pulse rounded-md bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
