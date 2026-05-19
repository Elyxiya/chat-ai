export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
}

export function success<T>(data?: T, message = 'Success'): ApiResponse<T> {
  return {
    code: 0,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function fail(code: number, message: string): ApiResponse {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
}

export enum ResultCode {
  SUCCESS = 0,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
  AI_QUOTA_EXCEEDED = 4290,
  AI_TIMEOUT = 4291,
  AI_CONTENT_FILTERED = 4292,
}
