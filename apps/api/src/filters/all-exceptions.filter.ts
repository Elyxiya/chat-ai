import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse, fail, ResultCode } from '../modules/common/result';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const env = process.env.NODE_ENV || 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = ResultCode.INTERNAL_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errResponse = exception.getResponse();
      message =
        typeof errResponse === 'string'
          ? errResponse
          : (errResponse as any).message || exception.message;
      code = this.mapStatusToCode(status);
    } else if (exception instanceof Error) {
      message = env === 'production' ? 'Internal server error' : exception.message;
    }

    const body: ApiResponse = fail(code, Array.isArray(message) ? message.join(', ') : message);
    response.status(status).json(body);
  }

  private mapStatusToCode(status: number): number {
    const map: Record<number, number> = {
      400: ResultCode.BAD_REQUEST,
      401: ResultCode.UNAUTHORIZED,
      403: ResultCode.FORBIDDEN,
      404: ResultCode.NOT_FOUND,
      500: ResultCode.INTERNAL_ERROR,
      503: ResultCode.SERVICE_UNAVAILABLE,
    };
    return map[status] || ResultCode.INTERNAL_ERROR;
  }
}
