import { createHash, randomBytes } from 'crypto';

export const RESET_TOKEN_TTL_MINUTES = 60;

/** Token gửi cho người dùng (base64url của 32 byte ngẫu nhiên) và băm SHA-256 để lưu. */
export function generateResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
