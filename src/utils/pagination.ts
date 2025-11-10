import { PaginationParams, PaginatedResponse } from '../types';

export const getPaginationParams = (
  page?: number,
  limit?: number
): PaginationParams => {
  const pageNum = page && page > 0 ? page : 1;
  const limitNum = limit && limit > 0 && limit <= 100 ? limit : 10;
  return { page: pageNum, limit: limitNum };
};

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};



