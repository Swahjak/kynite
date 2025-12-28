import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="space-y-6">
        {/* Title and description */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-64" />
        </div>

        {/* Tabs skeleton */}
        <div className="space-y-6">
          {/* Tab triggers */}
          <Skeleton className="h-10 w-full rounded-lg" />

          {/* Tab content */}
          <div className="space-y-4 rounded-lg border p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
