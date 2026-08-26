export default function RestaurantsLoading() {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-border/60" />
        <div className="h-4 w-20 animate-pulse rounded bg-border/60" />
      </div>
      <div className="mt-5 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-border/60" />
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-border/60" />
            <div className="h-4 w-40 animate-pulse rounded bg-border/60" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-border/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
