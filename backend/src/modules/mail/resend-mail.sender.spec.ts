import { MailDeliveryError } from './mail.types';
import { RESEND_ENDPOINT, ResendMailSender } from './resend-mail.sender';

const message = {
  to: 'a@b.vn',
  subject: 'Chủ đề',
  html: '<p>x</p>',
  text: 'x',
};

function fakeFetch(
  respond: (url: string, init: RequestInit) => Promise<Response>,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('ResendMailSender', () => {
  it('is disabled without an API key and never touches the network', async () => {
    const { fn, calls } = fakeFetch(() => Promise.reject(new Error('no')));
    const sender = new ResendMailSender({
      apiKey: '  ',
      from: 'x',
      fetchFn: fn,
    });
    expect(sender.enabled).toBe(false);
    await expect(sender.send(message)).rejects.toBeInstanceOf(
      MailDeliveryError,
    );
    expect(calls).toHaveLength(0);
  });

  it('POSTs to the Resend endpoint with Bearer auth, JSON body and idempotency key', async () => {
    const { fn, calls } = fakeFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'abc' }), { status: 200 }),
      ),
    );
    const sender = new ResendMailSender({
      apiKey: 're_secret',
      from: 'Thư viện <no-reply@x.vn>',
      fetchFn: fn,
    });
    const result = await sender.send({ ...message, idempotencyKey: 'k1' });
    expect(result).toEqual({ id: 'abc' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(RESEND_ENDPOINT);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_secret');
    expect(headers['Idempotency-Key']).toBe('k1');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      from: 'Thư viện <no-reply@x.vn>',
      to: ['a@b.vn'],
      subject: 'Chủ đề',
      html: '<p>x</p>',
      text: 'x',
    });
  });

  it.each([
    [500, true],
    [429, true],
    [422, false],
    [403, false],
  ])('maps HTTP %i to retryable=%s', async (status, retryable) => {
    const { fn } = fakeFetch(() =>
      Promise.resolve(new Response('{"message":"nope"}', { status })),
    );
    const sender = new ResendMailSender({
      apiKey: 'k',
      from: 'x',
      fetchFn: fn,
    });
    await expect(sender.send(message)).rejects.toMatchObject({
      retryable,
      status,
    });
  });

  it('treats a network failure as retryable and keeps the API key out of the error', async () => {
    const { fn } = fakeFetch(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    const sender = new ResendMailSender({
      apiKey: 're_secret',
      from: 'x',
      fetchFn: fn,
    });
    const err = (await sender
      .send(message)
      .catch((e: unknown) => e)) as MailDeliveryError;
    expect(err).toBeInstanceOf(MailDeliveryError);
    expect(err.retryable).toBe(true);
    expect(err.message).not.toContain('re_secret');
  });
});
