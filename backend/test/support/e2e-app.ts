import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { MemberType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { InMemoryMailSender } from '../../src/modules/mail/memory-mail.sender';
import { MAIL_SENDER } from '../../src/modules/mail/mail.types';
import { PrismaService } from '../../src/prisma/prisma.service';

export const PASSWORD = 'Secret123';

/** Khởi động app thật (cùng pipe + filter như main.ts) trên Postgres của DATABASE_URL. */
export async function createE2eApp() {
  process.env.JWT_SECRET ??= 'e2e-secret';
  // Thư luôn vào hộp thư trong bộ nhớ (test không bao giờ gọi Resend dù máy có RESEND_API_KEY)
  const mailbox = new InMemoryMailSender();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MAIL_SENDER)
    .useValue(mailbox)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  const prisma = app.get(PrismaService);
  const http = request(app.getHttpServer());

  const login = async (email: string): Promise<string> =>
    (
      await http
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200)
    ).body.accessToken as string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Ký JWT thẳng (bỏ qua /auth/login, vốn giới hạn 10 lần/phút/IP) cho test cần nhiều tài khoản. */
  const jwt = app.get(JwtService, { strict: false });
  const tokenFor = (u: {
    id: number;
    role: Role;
    memberType: MemberType | null;
  }) => jwt.sign({ sub: u.id, role: u.role, memberType: u.memberType });

  /** Chính sách chuẩn cho STUDENT để test không phụ thuộc dữ liệu có sẵn. */
  const ensureStudentPolicy = () => {
    const policy = {
      maxBooks: 3,
      loanDays: 14,
      renewLimit: 1,
      renewExtraDays: 7,
      finePerDay: 5000,
    };
    return prisma.loanPolicy.upsert({
      where: { memberType: MemberType.STUDENT },
      update: policy,
      create: { memberType: MemberType.STUDENT, ...policy },
    });
  };

  const createUser = async (
    email: string,
    role: Role,
    extra: { memberCode?: string; fullName?: string } = {},
  ) =>
    prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        fullName: extra.fullName ?? email,
        role,
        ...(role === Role.READER && {
          memberType: MemberType.STUDENT,
          memberCode: extra.memberCode,
        }),
      },
    });

  return {
    app,
    prisma,
    mailbox,
    http,
    login,
    auth,
    tokenFor,
    ensureStudentPolicy,
    createUser,
  };
}

/** Xoá dữ liệu test theo thứ tự khoá ngoại. `emailSuffix` nhận ra người dùng do test tạo. */
export async function cleanupE2eData(
  prisma: PrismaService,
  opts: { emailSuffix: string; bookTitlePrefix?: string },
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: opts.emailSuffix } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const books = opts.bookTitlePrefix
    ? await prisma.book.findMany({
        where: { title: { startsWith: opts.bookTitlePrefix } },
        select: { id: true },
      })
    : [];
  const bookIds = books.map((b) => b.id);
  await prisma.reservation.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { bookId: { in: bookIds } }] },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.fine.deleteMany({
    where: {
      OR: [
        { loan: { userId: { in: userIds } } },
        { loan: { copy: { bookId: { in: bookIds } } } },
      ],
    },
  });
  await prisma.loan.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { createdById: { in: userIds } },
        { copy: { bookId: { in: bookIds } } },
      ],
    },
  });
  await prisma.rating.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { bookId: { in: bookIds } }] },
  });
  await prisma.bookCopy.deleteMany({ where: { bookId: { in: bookIds } } });
  await prisma.bookAuthor.deleteMany({ where: { bookId: { in: bookIds } } });
  await prisma.book.deleteMany({ where: { id: { in: bookIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
