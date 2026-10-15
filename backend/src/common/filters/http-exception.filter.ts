import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Mã nghiệp vụ cho vi phạm ràng buộc duy nhất (P2002) lọt qua bước kiểm tra trước khi ghi
 * (hai yêu cầu đồng thời cùng qua kiểm tra rồi cùng ghi). Khoá: `Model.cột`.
 */
const UNIQUE_VIOLATION_CODES: Record<
  string,
  { code: string; message: string }
> = {
  'User.email': { code: 'EMAIL_EXISTS', message: 'Email đã được đăng ký' },
  'User.member_code': {
    code: 'MEMBER_CODE_EXISTS',
    message: 'Mã sinh viên / giảng viên đã được đăng ký',
  },
  'BookCopy.barcode': {
    code: 'BARCODE_EXISTS',
    message: 'Mã vạch đã tồn tại',
  },
  'Book.isbn': { code: 'ISBN_EXISTS', message: 'ISBN đã tồn tại' },
  'Category.name': {
    code: 'CATEGORY_EXISTS',
    message: 'Thể loại đã tồn tại',
  },
  'Category.slug': {
    code: 'CATEGORY_EXISTS',
    message: 'Thể loại đã tồn tại',
  },
};

/**
 * Format lỗi thống nhất cho mọi endpoint (FR-LOAN-08, checklist LAB 3 "Exception Handling"):
 * { statusCode, error, message, path, timestamp }
 * `error` là mã nghiệp vụ (LOAN_LIMIT_REACHED, UNPAID_FINE, ...) khi service ném ra.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'Lỗi hệ thống';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      error = HttpStatus[statusCode] ?? error;
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        error = b.error ?? error;
        // multer báo "File too large" (tiếng Anh) khi file tải lên vượt trần dung lượng
        if (
          statusCode === HttpStatus.PAYLOAD_TOO_LARGE &&
          message === 'File too large'
        ) {
          error = 'IMPORT_FILE_TOO_LARGE';
          message = 'File quá lớn (tối đa 5 MB)';
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ statusCode, error, message } = this.fromPrisma(exception));
      if (statusCode >= 500) this.logger.error(exception);
    } else if (this.isClientHttpError(exception)) {
      // Lỗi của Express/body-parser (JSON quá lớn, charset lạ...) mang sẵn status 4xx
      statusCode = exception.status;
      error = HttpStatus[statusCode] ?? 'BAD_REQUEST';
      message =
        statusCode === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'Dữ liệu gửi lên quá lớn'
          : exception.message;
    } else {
      this.logger.error(exception);
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private isClientHttpError(
    e: unknown,
  ): e is { status: number; message: string } {
    if (typeof e !== 'object' || e === null) return false;
    const status = (e as { status?: unknown }).status;
    return typeof status === 'number' && status >= 400 && status < 500;
  }

  /** Lỗi DB đã biết nguyên nhân → mã HTTP đúng thay vì 500. */
  private fromPrisma(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    error: string;
    message: string;
  } {
    if (e.code === 'P2002') {
      const meta = e.meta as
        { modelName?: string; target?: unknown } | undefined;
      const target = Array.isArray(meta?.target)
        ? meta.target.join(',')
        : String(meta?.target ?? '');
      const known = UNIQUE_VIOLATION_CODES[`${meta?.modelName}.${target}`];
      return {
        statusCode: HttpStatus.CONFLICT,
        error: known?.code ?? 'CONFLICT',
        message: known?.message ?? 'Dữ liệu bị trùng với bản ghi đã có',
      };
    }
    if (e.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'NOT_FOUND',
        message: 'Không tìm thấy bản ghi',
      };
    }
    if (e.code === 'P2003') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'REFERENCE_CONFLICT',
        message: 'Bản ghi đang được tham chiếu hoặc tham chiếu không tồn tại',
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Lỗi hệ thống',
    };
  }
}
