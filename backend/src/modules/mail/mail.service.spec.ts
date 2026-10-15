import { ConfigService } from '@nestjs/config';
import { MailService, resolveAppUrl } from './mail.service';
import { InMemoryMailSender } from './memory-mail.sender';
import { MailSender } from './mail.types';

const message = { to: 'a@b.vn', subject: 's', html: '<p>h</p>', text: 't' };
const config = (values: Record<string, string> = {}) =>
  new ConfigService(values);

describe('MailService', () => {
  it('skips (never throws) when the sender is not configured', async () => {
    const sender: MailSender = {
      enabled: false,
      send: jest.fn(),
    };
    const service = new MailService(sender, config());
    await expect(service.send(message)).resolves.toEqual({ status: 'SKIPPED' });
    expect(sender.send).not.toHaveBeenCalled();
    expect(service.enabled).toBe(false);
  });

  it('delivers through the sender', async () => {
    const sender = new InMemoryMailSender();
    const service = new MailService(sender, config());
    await expect(service.send(message)).resolves.toMatchObject({
      status: 'SENT',
    });
    expect(sender.outbox).toEqual([message]);
  });

  it('converts a provider failure into FAILED instead of throwing', async () => {
    const sender = new InMemoryMailSender();
    sender.failNext = 1;
    sender.failRetryable = false;
    const service = new MailService(sender, config());
    await expect(service.send(message)).resolves.toMatchObject({
      status: 'FAILED',
      retryable: false,
    });
  });

  it('sendDetached does not wait for the provider but drain() does', async () => {
    let release: () => void = () => undefined;
    const sender: MailSender = {
      enabled: true,
      send: () =>
        new Promise((resolve) => {
          release = () => resolve({ id: 'x' });
        }),
    };
    const service = new MailService(sender, config());
    service.sendDetached(message);
    let drained = false;
    const done = service.drain().then(() => (drained = true));
    await new Promise((r) => setImmediate(r));
    expect(drained).toBe(false);
    release();
    await done;
    expect(drained).toBe(true);
  });

  describe('resolveAppUrl', () => {
    it('prefers APP_PUBLIC_URL and strips trailing slashes', () => {
      expect(resolveAppUrl('https://lib.vn//', 'http://x')).toBe(
        'https://lib.vn',
      );
    });
    it('falls back to the first CORS origin', () => {
      expect(resolveAppUrl(undefined, 'https://a.vn, http://b')).toBe(
        'https://a.vn',
      );
    });
    it('falls back to localhost when nothing is set', () => {
      expect(resolveAppUrl(undefined, undefined)).toBe('http://localhost:3001');
    });
  });
});
