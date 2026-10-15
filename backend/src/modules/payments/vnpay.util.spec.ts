import {
  buildPaymentUrl,
  buildQueryString,
  formatVnpDate,
  parseVnpDate,
  resolveClientIp,
  signVnpParams,
  verifyVnpParams,
  vnpEncode,
} from './vnpay.util';

const SECRET = 'TESTSECRETKEY0123456789';

/** Tham số mẫu; chữ ký kỳ vọng tính ĐỘC LẬP bằng Python (hmac + urllib.parse.quote_plus). */
const VECTOR: Record<string, string> = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'DEMOTMN1',
  vnp_Amount: '1500000',
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'ULS0123456789ABCDEF',
  vnp_OrderInfo: 'Thanh toan tien phat thu vien ULS ULS0123456789ABCDEF',
  vnp_OrderType: 'other',
  vnp_Locale: 'vn',
  vnp_ReturnUrl: 'https://uls.example.vn/api/payments/vnpay/return',
  vnp_IpAddr: '203.0.113.7',
  vnp_CreateDate: '20261016093015',
  vnp_ExpireDate: '20261016094515',
};
const VECTOR_HASH =
  '2f023449ae57e662243d682e270418f26045e8441b2bc633f7f0290d11f63557f22c13757058b644cca58340394916345883f680609ee329680133f5b5e3d218';

describe('vnpay.util', () => {
  describe('signing', () => {
    it('matches an HMAC-SHA512 computed independently in Python', () => {
      expect(signVnpParams(VECTOR, SECRET)).toBe(VECTOR_HASH);
    });

    it('sorts names, encodes spaces as + and reserved characters as %XX', () => {
      expect(buildQueryString({ vnp_B: 'a b', vnp_A: 'x/y:z' })).toBe(
        'vnp_A=x%2Fy%3Az&vnp_B=a+b',
      );
    });

    it("encodes !'()*~ like PHP urlencode", () => {
      expect(vnpEncode("!'()*~")).toBe('%21%27%28%29%2A%7E');
    });

    it('ignores non vnp_ params and the hash fields themselves', () => {
      const noisy = {
        ...VECTOR,
        utm_source: 'x',
        vnp_SecureHash: 'abc',
        vnp_SecureHashType: 'HmacSHA512',
      };
      expect(signVnpParams(noisy, SECRET)).toBe(VECTOR_HASH);
    });
  });

  describe('verifyVnpParams', () => {
    const signed = { ...VECTOR, vnp_SecureHash: VECTOR_HASH };

    it('accepts a correct signature, case-insensitively', () => {
      expect(verifyVnpParams(signed, SECRET)).toBe(true);
      expect(
        verifyVnpParams(
          { ...VECTOR, vnp_SecureHash: VECTOR_HASH.toUpperCase() },
          SECRET,
        ),
      ).toBe(true);
    });

    it('rejects a tampered value, a wrong secret, a missing or short hash', () => {
      expect(verifyVnpParams({ ...signed, vnp_Amount: '100' }, SECRET)).toBe(
        false,
      );
      expect(verifyVnpParams(signed, 'another-secret')).toBe(false);
      expect(verifyVnpParams({ ...signed, vnp_SecureHash: '' }, SECRET)).toBe(
        false,
      );
      expect(verifyVnpParams(VECTOR, SECRET)).toBe(false);
      expect(
        verifyVnpParams(
          { ...signed, vnp_SecureHash: VECTOR_HASH.slice(2) },
          SECRET,
        ),
      ).toBe(false);
    });

    it('rejects an added vnp_ parameter (it is part of the signed data)', () => {
      expect(verifyVnpParams({ ...signed, vnp_Extra: '1' }, SECRET)).toBe(
        false,
      );
    });

    it('accepts either convention for empty parameters', () => {
      const withEmpty = { ...VECTOR, vnp_BankTranNo: '' };
      const skipped = signVnpParams(withEmpty, SECRET); // bỏ tham số rỗng
      expect(
        verifyVnpParams({ ...withEmpty, vnp_SecureHash: skipped }, SECRET),
      ).toBe(true);
    });
  });

  describe('buildPaymentUrl', () => {
    const input = {
      payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      tmnCode: 'DEMOTMN1',
      hashSecret: SECRET,
      returnUrl: 'https://uls.example.vn/api/payments/vnpay/return',
      txnRef: 'ULS0123456789ABCDEF',
      amount: 15_000,
      orderInfo: 'Thanh toan tien phat thu vien ULS ULS0123456789ABCDEF',
      ipAddr: '203.0.113.7',
      createdAt: new Date('2026-10-16T02:30:15.000Z'),
      expiresAt: new Date('2026-10-16T02:45:15.000Z'),
    };

    it('reproduces the independently signed vector (amount x100, GMT+7 dates)', () => {
      const url = buildPaymentUrl(input);
      expect(url).toBe(
        `${input.payUrl}?${buildQueryString(VECTOR)}&vnp_SecureHash=${VECTOR_HASH}`,
      );
    });

    it('produces a URL whose own query verifies', () => {
      const parsed = new URL(buildPaymentUrl({ ...input, bankCode: 'NCB' }));
      const params = Object.fromEntries(parsed.searchParams.entries());
      expect(params.vnp_BankCode).toBe('NCB');
      expect(verifyVnpParams(params, SECRET)).toBe(true);
    });
  });

  describe('dates', () => {
    it('formats in GMT+7 whatever the server zone', () => {
      expect(formatVnpDate(new Date('2026-10-16T02:30:15.000Z'))).toBe(
        '20261016093015',
      );
      expect(formatVnpDate(new Date('2026-10-16T20:00:00.000Z'))).toBe(
        '20261017030000',
      );
    });

    it('parses back and rejects malformed input', () => {
      expect(parseVnpDate('20261016093015')?.toISOString()).toBe(
        '2026-10-16T02:30:15.000Z',
      );
      expect(parseVnpDate('2026-10-16')).toBeNull();
      expect(parseVnpDate(undefined)).toBeNull();
    });
  });

  describe('resolveClientIp', () => {
    it('takes the first valid X-Forwarded-For entry', () => {
      expect(resolveClientIp('203.0.113.9, 10.0.0.1', '10.0.0.1')).toBe(
        '203.0.113.9',
      );
      expect(resolveClientIp('2001:db8::1', undefined)).toBe('2001:db8::1');
    });

    it('falls back to the socket (stripping ::ffff:) then to loopback, never echoing junk', () => {
      expect(resolveClientIp('<script>', '::ffff:192.0.2.5')).toBe('192.0.2.5');
      expect(resolveClientIp(undefined, undefined)).toBe('127.0.0.1');
      expect(resolveClientIp('a&b=c', 'nonsense')).toBe('127.0.0.1');
    });
  });
});
