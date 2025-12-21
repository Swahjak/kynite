import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = Array.from({ length: 12 });

export function YearViewSkeleton() {
  return (
    <div className="hidden flex-grow auto-rows-fr grid-cols-3 gap-4 overflow-hidden sm:grid lg:grid-cols-4">
      {MONTHS.map((_, monthIndex) => (
        <div
          key={monthIndex}
          className="flex h-full animate-pulse flex-col overflow-hidden rounded-md border"
        >
          <div className="bg-primary/5 px-1 py-2 text-center">
            <Skeleton className="mx-auto h-4 w-24" />
          </div>

          <div className="grid grid-cols-7 px-1 py-2 text-center text-xs">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="mx-auto h-3 w-3" />
            ))}
          </div>

          <div className="grid flex-grow grid-cols-7 gap-0 p-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-1"
              >
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="mt-1 h-1.5 w-3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
