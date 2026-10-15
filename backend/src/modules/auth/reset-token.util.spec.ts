import { createHash } from 'crypto';
import { generateResetToken, hashResetToken } from './reset-token.util';

describe('reset token', () => {
  it('is 32 random bytes in base64url and the stored value is only its SHA-256', () => {
    const { token, hash } = generateResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 byte -> 43 ký tự base64url
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token);
    expect(hashResetToken(token)).toBe(hash);
  });

  it('never repeats', () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateResetToken().token),
    );
    expect(tokens.size).toBe(1000);
  });
});
