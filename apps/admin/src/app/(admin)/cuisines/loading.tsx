export default function CuisinesLoading() {
  return (
    <div className="max-w-4xl">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-border/60" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-border/60" />
      <div className="mt-5 h-24 animate-pulse rounded-card bg-border/60" />
      <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-0">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-border/60" />
            <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-border/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
