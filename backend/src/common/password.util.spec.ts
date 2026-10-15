import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from '../modules/auth/dto/account.dto';
import { RegisterDto } from '../modules/auth/dto/register.dto';
import {
  generateMemberCode,
  generateTemporaryPassword,
  isValidPassword,
} from './password.util';

describe('password policy', () => {
  it('accepts 8..72 bytes and rejects shorter or longer', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('a'.repeat(72))).toBe(true);
    expect(isValidPassword('a'.repeat(73))).toBe(false);
  });

  it('counts bytes, not characters: Vietnamese letters can exceed the bcrypt 72-byte limit', () => {
    expect(isValidPassword('ệ'.repeat(24))).toBe(true); // 72 byte
    expect(isValidPassword('ệ'.repeat(25))).toBe(false); // 75 byte
  });

  it('register and change-password DTOs enforce exactly the same rules', async () => {
    const cases = [
      'short',
      '12345678',
      'a'.repeat(72),
      'a'.repeat(73),
      'ệ'.repeat(25),
    ];
    for (const password of cases) {
      const register = await validate(
        plainToInstance(RegisterDto, {
          email: 'a@b.vn',
          fullName: 'An',
          memberType: 'STUDENT',
          memberCode: 'SV001',
          password,
        }),
      );
      const change = await validate(
        plainToInstance(ChangePasswordDto, {
          currentPassword: 'x',
          newPassword: password,
        }),
      );
      expect(register.some((e) => e.property === 'password')).toBe(
        !isValidPassword(password),
      );
      expect(change.some((e) => e.property === 'newPassword')).toBe(
        !isValidPassword(password),
      );
    }
  });
});

describe('generateTemporaryPassword', () => {
  it('is 12 chars, passes the policy, has upper+lower+digit and no ambiguous glyphs', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toHaveLength(12);
      expect(isValidPassword(pw)).toBe(true);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/\d/);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat across many calls', () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateTemporaryPassword()),
    );
    expect(seen.size).toBe(500);
  });
});

describe('generateMemberCode', () => {
  it('matches the register member-code format', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMemberCode(new Date('2026-10-16T00:00:00Z'))).toMatch(
        /^DG26\d{6}$/,
      );
    }
  });
});
