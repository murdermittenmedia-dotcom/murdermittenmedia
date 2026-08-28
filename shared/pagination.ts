export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function getPageMeta(total: number, page: number, pageSize: number): PageMeta {
  const safeTotal = Math.max(0, Math.floor(total));
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safePageSize);
  return {
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasMore: safePage < totalPages,
  };
}
