import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Greeting skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-5 lg:gap-8">
          {/* Left column: TodaysFlow + TodaysChores */}
          <div className="space-y-6 md:col-span-3">
            {/* TodaysFlow skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>

            {/* TodaysChores skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>

          {/* Right column: ActiveTimers + WeeklyStars */}
          <div className="space-y-4 md:col-span-2 md:space-y-5">
            {/* ActiveTimers skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>

            {/* WeeklyStars skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
