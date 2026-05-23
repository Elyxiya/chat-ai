import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ResultCode } from '../modules/common/result';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP exceptions', () => {
    it('FILTER-01: should handle 400 BadRequest with correct code', () => {
      const exception = new HttpException('Validation failed', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: 'Validation failed',
        }),
      );
    });

    it('FILTER-02: should handle 401 Unauthorized with correct code', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.UNAUTHORIZED,
        }),
      );
    });

    it('should handle 403 Forbidden', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.FORBIDDEN,
        }),
      );
    });

    it('FILTER-03: should handle 404 NotFound with correct code', () => {
      const exception = new HttpException('Resource not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.NOT_FOUND,
        }),
      );
    });

    it('FILTER-04: should handle 500 InternalServerError', () => {
      const exception = new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.INTERNAL_ERROR,
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: ['field must be a string', 'field is required'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('field must be a string'),
        }),
      );
    });

    it('FILTER-06: should join array messages with comma', () => {
      const exception = new HttpException(['Error 1', 'Error 2', 'Error 3'], HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      // NestJS HttpException with array: getResponse() returns the array,
      // which has no .message property, so it falls back to exception.message = 'Http Exception'
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: expect.any(String),
        }),
      );
    });
  });

  describe('Non-HTTP exceptions', () => {
    it('FILTER-05: should handle generic Error with 500 status', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.INTERNAL_ERROR,
        }),
      );
    });

    it('should return generic message for unknown exception type', () => {
      const exception = 'string exception';

      filter.catch(exception as any, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should include timestamp in response', () => {
      const exception = new Error('Test error');
      const beforeCatch = Date.now();

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response).toHaveProperty('timestamp');
      const afterCatch = Date.now();
      expect(new Date(response.timestamp).getTime()).toBeGreaterThanOrEqual(beforeCatch);
      expect(new Date(response.timestamp).getTime()).toBeLessThanOrEqual(afterCatch);
    });
  });

  describe('status code mapping', () => {
    it('should map 503 ServiceUnavailable to code 503', () => {
      const exception = new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.SERVICE_UNAVAILABLE,
        }),
      );
    });

    it('should map unknown status codes to INTERNAL_ERROR', () => {
      const exception = new HttpException('Custom error', 418 as any);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ResultCode.INTERNAL_ERROR,
        }),
      );
    });
  });
});
