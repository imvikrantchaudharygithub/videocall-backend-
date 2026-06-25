export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export const successResponse = <T>(data: T, pagination?: ApiSuccess<T>['pagination']): ApiSuccess<T> => ({
  success: true,
  data,
  ...(pagination ? { pagination } : {}),
});

export const errorResponse = (code: string, message: string): ApiError => ({
  success: false,
  error: { code, message },
});
