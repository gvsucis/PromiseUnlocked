export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePagination(
  query: { page?: string | string[]; pageSize?: string | string[]; limit?: string | string[] },
  defaultSize = 20,
  maxSize = 100
): PaginationParams {
  const rawSize = Array.isArray(query.pageSize)
    ? query.pageSize[0]
    : (query.pageSize ?? (Array.isArray(query.limit) ? query.limit[0] : query.limit));
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;

  const pageSize = Math.min(maxSize, Math.max(1, Number(rawSize) || defaultSize));
  const page = Math.max(1, Number(rawPage) || 1);
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}
