import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeleton: a title block over a bordered panel of rows, the shape every workspace screen shares. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-5 py-4" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="overflow-hidden rounded-lg bg-card shadow-card">
        <div className="border-b px-4 py-2.5">
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-2.5 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
