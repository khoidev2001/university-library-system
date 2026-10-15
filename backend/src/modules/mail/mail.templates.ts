import { LIBRARY_UTC_OFFSET_MINUTES } from '../../common/date.util';

/** Nội dung thư đã dựng xong (chưa có người nhận). */
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

const LIBRARY_NAME = 'Thư viện Đại học Xây dựng Miền Trung';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** dd/MM/yyyy theo giờ thư viện (không phụ thuộc múi giờ của máy chủ). */
export function formatLibraryDate(
  date: Date,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${shifted.getUTCFullYear()}`;
}

function layout(title: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#16243c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ddd6c8;border-radius:10px;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #ddd6c8;font-size:16px;font-weight:bold;">${escapeHtml(LIBRARY_NAME)}</td></tr>
<tr><td style="padding:24px 28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #ddd6c8;font-size:12px;line-height:1.5;color:#5b6577;">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#16243c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}

export function passwordResetEmail(input: {
  fullName: string;
  link: string;
  validMinutes: number;
}): MailContent {
  const { fullName, link, validMinutes } = input;
  const subject = 'Đặt lại mật khẩu thư viện';
  const html = layout(
    subject,
    `<p>Xin chào ${escapeHtml(fullName)},</p>
<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản thư viện của bạn. Liên kết dưới đây chỉ dùng được một lần và hết hạn sau ${validMinutes} phút.</p>
${button(link, 'Đặt lại mật khẩu')}
<p style="font-size:13px;color:#5b6577;">Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:<br><span style="word-break:break-all;">${escapeHtml(link)}</span></p>`,
    'Nếu bạn không yêu cầu việc này, hãy bỏ qua thư; mật khẩu hiện tại vẫn giữ nguyên. Không chia sẻ liên kết này với bất kỳ ai.',
  );
  const text = `Xin chào ${fullName},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản thư viện của bạn.
Mở liên kết sau (dùng một lần, hết hạn sau ${validMinutes} phút):

${link}

Nếu bạn không yêu cầu việc này, hãy bỏ qua thư; mật khẩu hiện tại vẫn giữ nguyên.
Không chia sẻ liên kết này với bất kỳ ai.`;
  return { subject, html, text };
}

export function welcomeReaderEmail(input: {
  fullName: string;
  email: string;
  memberCode: string;
  loginUrl: string;
}): MailContent {
  const { fullName, email, memberCode, loginUrl } = input;
  const subject = 'Chào mừng bạn đến với thư viện';
  const html = layout(
    subject,
    `<p>Xin chào ${escapeHtml(fullName)},</p>
<p>Thủ thư vừa tạo tài khoản bạn đọc cho bạn.</p>
<ul style="padding-left:20px;">
<li>Email đăng nhập: <strong>${escapeHtml(email)}</strong></li>
<li>Mã thẻ: <strong>${escapeHtml(memberCode)}</strong></li>
</ul>
<p>Mật khẩu tạm thời do thủ thư trao trực tiếp cho bạn (không gửi qua thư). Lần đăng nhập đầu tiên hệ thống sẽ yêu cầu bạn đặt mật khẩu mới.</p>
${button(loginUrl, 'Đăng nhập')}`,
    'Thư tự động từ hệ thống thư viện. Nếu bạn không phải bạn đọc của thư viện, hãy bỏ qua thư này.',
  );
  const text = `Xin chào ${fullName},

Thủ thư vừa tạo tài khoản bạn đọc cho bạn.
Email đăng nhập: ${email}
Mã thẻ: ${memberCode}

Mật khẩu tạm thời do thủ thư trao trực tiếp cho bạn (không gửi qua thư).
Lần đăng nhập đầu tiên hệ thống sẽ yêu cầu bạn đặt mật khẩu mới.
Đăng nhập tại: ${loginUrl}`;
  return { subject, html, text };
}

export interface ReminderLoanItem {
  title: string;
  dueAt: Date;
}

export function loanReminderEmail(input: {
  fullName: string;
  kind: 'due' | 'overdue';
  loans: ReminderLoanItem[];
  loansUrl: string;
  accountUrl: string;
}): MailContent {
  const { fullName, kind, loans, loansUrl, accountUrl } = input;
  const overdue = kind === 'overdue';
  const count = loans.length;
  const subject = overdue
    ? count === 1
      ? 'Bạn có 1 cuốn sách đã quá hạn trả'
      : `Bạn có ${count} cuốn sách đã quá hạn trả`
    : count === 1
      ? 'Sách sắp đến hạn trả'
      : `${count} cuốn sách sắp đến hạn trả`;
  const lead = overdue
    ? 'Các cuốn sau đã quá hạn. Vui lòng mang sách tới quầy thư viện để tránh tiền phạt tăng thêm:'
    : 'Các cuốn sau sắp đến hạn trả. Bạn có thể gia hạn trong mục "Sách của tôi" nếu cần:';
  const verb = overdue ? 'quá hạn từ' : 'đến hạn ngày';
  const itemsHtml = loans
    .map(
      (l) =>
        `<li style="margin-bottom:6px;"><strong>${escapeHtml(l.title)}</strong> &mdash; ${verb} ${formatLibraryDate(l.dueAt)}</li>`,
    )
    .join('');
  const html = layout(
    subject,
    `<p>Xin chào ${escapeHtml(fullName)},</p>
<p>${escapeHtml(lead)}</p>
<ul style="padding-left:20px;">${itemsHtml}</ul>
${button(loansUrl, 'Xem sách của tôi')}`,
    `Bạn nhận thư này vì đã bật nhắc hạn qua email. Tắt tại <a href="${escapeHtml(accountUrl)}" style="color:#5b6577;">trang tài khoản</a>.`,
  );
  const text = `Xin chào ${fullName},

${lead}

${loans.map((l) => `- ${l.title} - ${verb} ${formatLibraryDate(l.dueAt)}`).join('\n')}

Xem sách của tôi: ${loansUrl}

Tắt nhắc hạn qua email tại: ${accountUrl}`;
  return { subject, html, text };
}
