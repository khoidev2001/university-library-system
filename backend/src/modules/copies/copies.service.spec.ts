import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CopyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { CopiesService } from './copies.service';

describe('CopiesService', () => {
  let service: CopiesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [CopiesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CopiesService);
  });

  it('create: new copy starts AVAILABLE; duplicate barcode → BARCODE_EXISTS; unknown book → 404', async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 1 });
    prisma.bookCopy.findUnique.mockResolvedValue(null);
    prisma.bookCopy.create.mockImplementation(async ({ data }) => ({
      id: 10,
      ...data,
    }));

    const copy = await service.create(1, { barcode: 'LIB-1' });
    expect(copy).toMatchObject({
      bookId: 1,
      barcode: 'LIB-1',
      status: CopyStatus.AVAILABLE,
    });

    prisma.bookCopy.findUnique.mockResolvedValue({ id: 3 });
    await expect(service.create(1, { barcode: 'LIB-1' })).rejects.toMatchObject(
      { code: 'BARCODE_EXISTS' },
    );

    prisma.book.findUnique.mockResolvedValue(null);
    await expect(
      service.create(9, { barcode: 'LIB-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: refuses status changes while a loan is ACTIVE, and manual BORROWED', async () => {
    prisma.bookCopy.findUnique.mockResolvedValue({
      id: 10,
      status: CopyStatus.BORROWED,
    });
    prisma.loan.count.mockResolvedValue(1);
    await expect(
      service.update(10, { status: CopyStatus.AVAILABLE }),
    ).rejects.toMatchObject({ code: 'COPY_HAS_ACTIVE_LOAN' });

    prisma.bookCopy.findUnique.mockResolvedValue({
      id: 10,
      status: CopyStatus.AVAILABLE,
    });
    prisma.loan.count.mockResolvedValue(0);
    await expect(
      service.update(10, { status: CopyStatus.BORROWED }),
    ).rejects.toMatchObject({ code: 'COPY_HAS_ACTIVE_LOAN' });
  });

  it('update: allows MAINTENANCE on a free copy and shelf changes without status', async () => {
    prisma.bookCopy.findUnique.mockResolvedValue({
      id: 10,
      status: CopyStatus.AVAILABLE,
    });
    prisma.loan.count.mockResolvedValue(0);
    prisma.bookCopy.update.mockImplementation(async ({ data }) => ({
      id: 10,
      ...data,
    }));

    expect(
      (await service.update(10, { status: CopyStatus.MAINTENANCE })).status,
    ).toBe(CopyStatus.MAINTENANCE);
    await service.update(10, { shelfLocation: 'A1' });
    expect(prisma.loan.count).toHaveBeenCalledTimes(1);
  });

  it('findByBook lists copies ordered by barcode', async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 1 });
    prisma.bookCopy.findMany.mockResolvedValue([{ id: 1 }]);
    expect(await service.findByBook(1)).toHaveLength(1);
    expect(prisma.bookCopy.findMany).toHaveBeenCalledWith({
      where: { bookId: 1 },
      orderBy: { barcode: 'asc' },
    });
  });
});
