export default function RestaurantDetailLoading() {
  return (
    <div className="max-w-5xl">
      <div className="h-4 w-24 animate-pulse rounded bg-border/60" />
      <div className="mt-3 h-48 w-full animate-pulse rounded-card bg-border/60" />
      <div className="mt-4 flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-border/60" />
        <div className="flex-1">
          <div className="h-6 w-56 animate-pulse rounded bg-border/60" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-border/60" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="h-32 animate-pulse rounded-card bg-border/60" />
          <div className="h-64 animate-pulse rounded-card bg-border/60" />
        </div>
        <div className="h-80 animate-pulse rounded-card bg-border/60" />
      </div>
    </div>
  );
}
