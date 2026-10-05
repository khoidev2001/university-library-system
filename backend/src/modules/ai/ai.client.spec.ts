import { ConfigService } from '@nestjs/config';
import { MemberType } from '@prisma/client';
import { AiClient, AiUnavailableError, OverdueFeatures } from './ai.client';

const features: OverdueFeatures = {
  memberType: MemberType.STUDENT,
  priorLoans: 4,
  priorOverdue: 1,
  activeLoans: 2,
  categoryId: 3,
  loanDays: 14,
  month: 10,
};

function client(fetchImpl: jest.Mock): AiClient {
  const config = {
    get: jest.fn((key: string, def?: unknown) =>
      key === 'AI_SERVICE_URL' ? 'http://ai:8000/' : def,
    ),
  } as unknown as ConfigService;
  return new AiClient(config, fetchImpl as unknown as typeof fetch);
}

describe('AiClient.predictOverdue', () => {
  it('sends snake_case features and returns the risk', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ risk: 0.72 }) });
    expect(await client(fetchMock).predictOverdue(features)).toBe(0.72);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ai:8000/predict-overdue');
    expect(JSON.parse(init.body)).toEqual({
      member_type: 'STUDENT',
      prior_loans: 4,
      prior_overdue: 1,
      active_loans: 2,
      category_id: 3,
      loan_days: 14,
      month: 10,
    });
  });

  it('returns null instead of throwing on timeout, HTTP error or junk payload', async () => {
    const timeout = jest.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      }),
    );
    expect(await client(timeout).predictOverdue(features)).toBeNull();

    const http500 = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    expect(await client(http500).predictOverdue(features)).toBeNull();

    const junk = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ risk: 'high' }) });
    expect(await client(junk).predictOverdue(features)).toBeNull();

    const outOfRange = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ risk: 1.5 }) });
    expect(await client(outOfRange).predictOverdue(features)).toBeNull();
  });
});

describe('AiClient.recommend', () => {
  it('passes user_id and k, returns the ids', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ book_ids: [1, 2, 3] }),
    });
    expect(await client(fetchMock).recommend(7, 10)).toEqual([1, 2, 3]);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('user_id')).toBe('7');
    expect(url.searchParams.get('k')).toBe('10');
  });

  it('throws AiUnavailableError on failure so the caller can fall back', async () => {
    const down = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client(down).recommend(7, 10)).rejects.toBeInstanceOf(
      AiUnavailableError,
    );

    const http503 = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(client(http503).recommend(7, 10)).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('tolerates a payload without book_ids', async () => {
    const empty = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await client(empty).recommend(7, 10)).toEqual([]);
  });
});

describe('AiClient.train / metrics', () => {
  it('train gọi POST /train và chịu được lỗi', async () => {
    const ok = jest.fn().mockResolvedValue({ ok: true });
    await expect(client(ok).train()).resolves.toBeUndefined();
    expect(ok.mock.calls[0][0]).toBe('http://ai:8000/train');
    expect(ok.mock.calls[0][1].method).toBe('POST');

    const down = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client(down).train()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );

    const http503 = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(client(http503).train()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('metrics trả nguyên payload của AI service', async () => {
    const payload = {
      recommender: { precision_at_5: 0.31 },
      overdue: { chosen: 'logistic_regression' },
    };
    const ok = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => payload });
    await expect(client(ok).metrics()).resolves.toEqual(payload);

    const down = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(client(down).metrics()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });
});
