import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page title skeleton */}
      <Skeleton className="h-8 w-48" />

      {/* Content blocks */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg" />
      </div>
    </div>
  );
}
