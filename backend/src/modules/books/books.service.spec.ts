import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CopyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { BooksService, estimatePrice } from './books.service';
import { QueryBooksDto } from './dto/books.dto';
import { GoogleBooksClient } from './google-books.client';

const row = {
  id: 1,
  isbn: '9780000000001',
  title: 'Clean Code',
  description: 'desc',
  publisher: 'PH',
  publishedYear: 2008,
  price: 120000,
  coverUrl: null,
  categoryId: 2,
  category: { id: 2, name: 'CNTT', slug: 'cntt' },
  authors: [
    { bookId: 1, authorId: 4, author: { id: 4, name: 'Robert Martin' } },
  ],
};

describe('BooksService', () => {
  let service: BooksService;
  let prisma: PrismaMock;
  const google = { lookup: jest.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleBooksClient, useValue: google },
      ],
    }).compile();
    service = moduleRef.get(BooksService);
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('builds an OR over title / isbn / author and adds copy counts', async () => {
      prisma.book.findMany.mockResolvedValue([row]);
      prisma.book.count.mockResolvedValue(1);
      prisma.bookCopy.groupBy.mockResolvedValue([
        { bookId: 1, status: CopyStatus.AVAILABLE, _count: { _all: 2 } },
        { bookId: 1, status: CopyStatus.BORROWED, _count: { _all: 1 } },
      ]);
      const query = Object.assign(new QueryBooksDto(), {
        q: 'clean',
        available: true,
        categoryId: 2,
      });

      const page = await service.search(query);

      const where = prisma.book.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
      expect(where.categoryId).toBe(2);
      expect(where.copies).toEqual({ some: { status: CopyStatus.AVAILABLE } });
      expect(page.items[0]).toMatchObject({
        title: 'Clean Code',
        copiesTotal: 3,
        copiesAvailable: 2,
        authors: [{ name: 'Robert Martin' }],
      });
    });

    it('returns an empty page without querying copy counts', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);
      const page = await service.search(new QueryBooksDto());
      expect(page.total).toBe(0);
      expect(prisma.bookCopy.groupBy).not.toHaveBeenCalled();
    });
  });

  it('findOne adds description and rating summary; 404 when missing', async () => {
    prisma.book.findUnique.mockResolvedValue(row);
    prisma.bookCopy.groupBy.mockResolvedValue([]);
    prisma.rating.aggregate.mockResolvedValue({
      _avg: { score: 4.5 },
      _count: 2,
    });
    const detail = await service.findOne(1);
    expect(detail).toMatchObject({
      description: 'desc',
      ratingAvg: 4.5,
      ratingCount: 2,
      copiesTotal: 0,
    });

    prisma.book.findUnique.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('create', () => {
    const dto = {
      title: 'T',
      isbn: '978-0000000001',
      price: 1000,
      categoryId: 2,
      authorIds: [4],
    };

    it('validates category/authors, normalises ISBN and links authors', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 2 });
      prisma.author.count.mockResolvedValue(1);
      prisma.book.findUnique.mockResolvedValue(null);
      prisma.book.create.mockResolvedValue(row);

      await service.create(dto);

      const data = prisma.book.create.mock.calls[0][0].data;
      expect(data.isbn).toBe('9780000000001');
      expect(data.authors).toEqual({ create: [{ authorId: 4 }] });
    });

    it('rejects duplicate ISBN with ISBN_EXISTS', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 2 });
      prisma.author.count.mockResolvedValue(1);
      prisma.book.findUnique.mockResolvedValue({ id: 8 });
      await expect(service.create(dto)).rejects.toMatchObject({
        code: 'ISBN_EXISTS',
      });
    });

    it('404s when a category or an author does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.category.findUnique.mockResolvedValue({ id: 2 });
      prisma.author.count.mockResolvedValue(0);
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('update replaces authors only when authorIds is given', async () => {
    prisma.book.findUnique.mockResolvedValue(row);
    prisma.book.update.mockResolvedValue(row);
    prisma.bookCopy.groupBy.mockResolvedValue([]);

    await service.update(1, { title: 'New' });
    expect(prisma.book.update.mock.calls[0][0].data.authors).toBeUndefined();

    prisma.author.count.mockResolvedValue(1);
    await service.update(1, { authorIds: [4] });
    expect(prisma.book.update.mock.calls[1][0].data.authors).toEqual({
      deleteMany: {},
      create: [{ authorId: 4 }],
    });
  });

  describe('remove', () => {
    it('refuses when a copy is on loan (BOOK_HAS_ACTIVE_LOANS)', async () => {
      prisma.book.findUnique.mockResolvedValue(row);
      prisma.loan.count.mockResolvedValue(1);
      await expect(service.remove(1)).rejects.toMatchObject({
        code: 'BOOK_HAS_ACTIVE_LOANS',
      });
      expect(prisma.book.delete).not.toHaveBeenCalled();
    });

    it('deletes ratings, free copies and the book in one transaction', async () => {
      prisma.book.findUnique.mockResolvedValue(row);
      prisma.loan.count.mockResolvedValue(0);
      await service.remove(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.book.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('importByIsbn', () => {
    it('skips existing and unknown ISBNs, creates the rest with author/category upserts', async () => {
      prisma.book.findUnique.mockImplementation(async ({ where }) =>
        where.isbn === '111' ? { id: 1 } : null,
      );
      google.lookup.mockImplementation(async (isbn: string) =>
        isbn === '333'
          ? {
              isbn,
              title: 'Found',
              authors: ['A'],
              categories: ['Fiction / Sci-Fi'],
              pageCount: 300,
            }
          : null,
      );
      prisma.category.upsert.mockResolvedValue({
        id: 5,
        name: 'Fiction',
        slug: 'fiction',
      });
      prisma.author.findFirst.mockResolvedValue(null);
      prisma.author.create.mockResolvedValue({ id: 6, name: 'A' });
      prisma.book.create.mockResolvedValue({
        ...row,
        category: { id: 5, name: 'Fiction', slug: 'fiction' },
      });

      const report = await service.importByIsbn({
        isbns: ['111', '2-22', '333'],
      });

      expect(report.skipped).toEqual([
        { isbn: '111', reason: 'EXISTS' },
        { isbn: '222', reason: 'NOT_FOUND' },
      ]);
      expect(report.created).toHaveLength(1);
      expect(prisma.category.upsert.mock.calls[0][0].create).toEqual({
        name: 'Fiction',
        slug: 'fiction',
      });
      expect(prisma.book.create.mock.calls[0][0].data.price).toBe(150000);
    });
  });

  it('estimatePrice: 500đ/page, min 50.000đ, rounded to 1.000đ', () => {
    expect(estimatePrice(undefined)).toBe(100000);
    expect(estimatePrice(50)).toBe(50000);
    expect(estimatePrice(333)).toBe(167000);
  });
});
