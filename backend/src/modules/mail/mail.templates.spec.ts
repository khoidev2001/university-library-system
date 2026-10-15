import {
  escapeHtml,
  formatLibraryDate,
  loanReminderEmail,
  passwordResetEmail,
  welcomeReaderEmail,
} from './mail.templates';

describe('mail templates', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('formats dates in library time (UTC+7) regardless of server timezone', () => {
    // 2026-10-15 20:00 UTC là 03:00 ngày 16 theo giờ Việt Nam
    expect(formatLibraryDate(new Date('2026-10-15T20:00:00Z'), 420)).toBe(
      '16/10/2026',
    );
  });

  it('password reset: link in both html and text, user name escaped', () => {
    const link = 'https://lib.vn/reset-password?token=abc_DEF-123';
    const mail = passwordResetEmail({
      fullName: '<b>Nguyễn</b>',
      link,
      validMinutes: 60,
    });
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.html).not.toContain('<b>Nguyễn</b>');
    expect(mail.html).toContain('&lt;b&gt;Nguyễn&lt;/b&gt;');
    expect(mail.text).toContain(link);
    expect(mail.text).toContain('60 phút');
  });

  it('welcome mail never carries a password', () => {
    const mail = welcomeReaderEmail({
      fullName: 'An',
      email: 'an@x.vn',
      memberCode: 'DG123',
      loginUrl: 'https://lib.vn/login',
    });
    expect(mail.text).toContain('DG123');
    expect(mail.text.toLowerCase()).not.toMatch(/mật khẩu:/);
  });

  it('reminder: singular/plural subjects, kind wording, opt-out link', () => {
    const base = {
      fullName: 'An',
      loansUrl: 'https://lib.vn/my/loans',
      accountUrl: 'https://lib.vn/account',
    };
    const dueAt = new Date('2026-10-20T05:00:00Z');
    const one = loanReminderEmail({
      ...base,
      kind: 'overdue',
      loans: [{ title: 'Sách <1>', dueAt }],
    });
    expect(one.subject).toBe('Bạn có 1 cuốn sách đã quá hạn trả');
    expect(one.html).toContain('Sách &lt;1&gt;');
    expect(one.text).toContain('quá hạn từ 20/10/2026');
    expect(one.html).toContain('https://lib.vn/account');

    const many = loanReminderEmail({
      ...base,
      kind: 'due',
      loans: [
        { title: 'A', dueAt },
        { title: 'B', dueAt },
      ],
    });
    expect(many.subject).toBe('2 cuốn sách sắp đến hạn trả');
    expect(many.text).toContain('đến hạn ngày 20/10/2026');
  });
});
