import { randomInt } from 'crypto';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/** Chính sách mật khẩu DUY NHẤT của hệ thống: đăng ký, đổi, đặt lại đều dùng chung. */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt chỉ đọc 72 byte đầu; dài hơn sẽ bị cắt âm thầm nên từ chối ngay. */
export const PASSWORD_MAX_BYTES = 72;

export function isValidPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES
  );
}

function MaxBytes(options?: ValidationOptions) {
  return (target: object, propertyKey: string) =>
    registerDecorator({
      name: 'maxBytes',
      target: target.constructor,
      propertyName: propertyKey,
      options: {
        message: `Mật khẩu tối đa ${PASSWORD_MAX_BYTES} byte`,
        ...options,
      },
      validator: {
        validate: (v: unknown) =>
          typeof v === 'string' &&
          Buffer.byteLength(v, 'utf8') <= PASSWORD_MAX_BYTES,
      },
    });
}

/** Gắn lên trường mật khẩu mới trong DTO. */
export function IsPasswordValue() {
  return applyDecorators(
    ApiProperty({
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_BYTES,
      example: 'Secret123',
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    // MaxLength giữ cho thông báo lỗi quen thuộc; MaxBytes mới là ràng buộc thật với chữ có dấu.
    MaxLength(PASSWORD_MAX_BYTES),
    MaxBytes(),
  );
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGIT = '23456789';
const ALL = UPPER + LOWER + DIGIT;

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/**
 * Mật khẩu tạm: 12 ký tự, bỏ các ký tự dễ nhầm (0 O 1 l I), luôn có chữ hoa, chữ thường, chữ số
 * để đọc lên / in ra phiếu mà không sai, và thoả chính sách chung. Nguồn ngẫu nhiên: crypto.randomInt.
 */
export function generateTemporaryPassword(length = 12): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Mã bạn đọc tự sinh: DG + 2 số cuối năm + 6 chữ số ngẫu nhiên (khớp /^[A-Za-z0-9-]{3,30}$/). */
export function generateMemberCode(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  let digits = '';
  for (let i = 0; i < 6; i++) digits += String(randomInt(10));
  return `DG${yy}${digits}`;
}
