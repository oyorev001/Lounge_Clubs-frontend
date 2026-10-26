import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const DEFAULT_PAGE_SIZE = 10;

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const page = usePaginationState(items.length, pageSize);
  const paged = items.slice(page.index * pageSize, page.index * pageSize + pageSize);
  return { ...page, paged, pageSize };
}

function usePaginationState(total: number, pageSize: number) {
  const [index, setIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (index > totalPages - 1) setIndex(totalPages - 1);
  }, [index, totalPages]);

  return {
    index,
    totalPages,
    total,
    next: () => setIndex((p) => Math.min(p + 1, totalPages - 1)),
    prev: () => setIndex((p) => Math.max(0, p - 1)),
    reset: () => setIndex(0),
  };
}

export function PaginationControls({
  index,
  totalPages,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onPrev,
  onNext,
}: {
  index: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= pageSize) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        Page {index + 1} of {totalPages} ({total} total)
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={index === 0} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button size="sm" variant="outline" disabled={index >= totalPages - 1} onClick={onNext}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
