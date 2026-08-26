import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  totalCount,
  makeHref,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  makeHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-primary-dark">
        {from}–{to} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <span className="rounded-full border border-border px-3 py-1.5 font-medium text-border">Previous</span>
        ) : (
          <Link
            href={makeHref(page - 1)}
            scroll={false}
            className="rounded-full border border-border px-3 py-1.5 font-medium text-primary hover:border-primary/30"
          >
            Previous
          </Link>
        )}
        <span className="text-primary-dark">
          Page {page} of {totalPages}
        </span>
        {page >= totalPages ? (
          <span className="rounded-full border border-border px-3 py-1.5 font-medium text-border">Next</span>
        ) : (
          <Link
            href={makeHref(page + 1)}
            scroll={false}
            className="rounded-full border border-border px-3 py-1.5 font-medium text-primary hover:border-primary/30"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
