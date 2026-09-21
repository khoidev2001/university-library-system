import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lỗi nghiệp vụ có mã rõ ràng (SDD mục 5.10). `error` trong body = mã, để FE và test đối chiếu.
 * Mặc định 409 Conflict; truyền status khác khi cần (403 NOT_BORROWED, 401 INVALID_CREDENTIALS...).
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.CONFLICT,
  ) {
    super({ statusCode: status, error: code, message }, status);
  }
}
