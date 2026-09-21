import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { AuthorsService } from '../authors/authors.service';
import { QueryAuthorsDto } from '../authors/dto/authors.dto';
import { CategoriesService, slugify } from './categories.service';

describe('slugify', () => {
  it('strips Vietnamese diacritals and joins with dashes', () => {
    expect(slugify('Khoa học máy tính')).toBe('khoa-hoc-may-tinh');
    expect(slugify('  Đồ án / Tốt nghiệp!! ')).toBe('do-an-tot-nghiep');
  });
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  it('findAll maps _count to bookCount', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 1, name: 'A', slug: 'a', _count: { books: 3 } },
    ]);
    expect(await service.findAll()).toEqual([
      { id: 1, name: 'A', slug: 'a', bookCount: 3 },
    ]);
  });

  it('create derives the slug and rejects clashes', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
    }));
    expect(await service.create({ name: 'Văn học' })).toMatchObject({
      slug: 'van-hoc',
    });

    prisma.category.findFirst.mockResolvedValue({ id: 2 });
    await expect(service.create({ name: 'Văn học' })).rejects.toMatchObject({
      code: 'CATEGORY_EXISTS',
    });
  });

  it('update re-slugs from the new name and excludes itself from the clash check', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 1,
      name: 'A',
      slug: 'a',
    });
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.update.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
    }));
    expect(await service.update(1, { name: 'Lịch sử' })).toMatchObject({
      slug: 'lich-su',
    });
    expect(prisma.category.findFirst.mock.calls[0][0].where.id).toEqual({
      not: 1,
    });
  });

  it('remove refuses a category in use and 404s an unknown one', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 1 });
    prisma.book.count.mockResolvedValue(2);
    await expect(service.remove(1)).rejects.toMatchObject({
      code: 'CATEGORY_IN_USE',
    });

    prisma.book.count.mockResolvedValue(0);
    await service.remove(1);
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });

    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.remove(9)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AuthorsService', () => {
  let service: AuthorsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AuthorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuthorsService);
  });

  it('findAll searches by name and maps bookCount', async () => {
    prisma.author.findMany.mockResolvedValue([
      { id: 1, name: 'A', _count: { books: 2 } },
    ]);
    prisma.author.count.mockResolvedValue(1);
    const page = await service.findAll(
      Object.assign(new QueryAuthorsDto(), { q: 'a' }),
    );
    expect(page.items).toEqual([{ id: 1, name: 'A', bookCount: 2 }]);
    expect(prisma.author.findMany.mock.calls[0][0].where.name.contains).toBe(
      'a',
    );
  });

  it('create trims, update 404s, remove refuses authors with books', async () => {
    prisma.author.create.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
    }));
    expect((await service.create({ name: '  B ' })).name).toBe('B');

    prisma.author.findUnique.mockResolvedValue(null);
    await expect(service.update(9, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.author.findUnique.mockResolvedValue({ id: 1 });
    prisma.bookAuthor.count.mockResolvedValue(1);
    await expect(service.remove(1)).rejects.toMatchObject({
      code: 'AUTHOR_IN_USE',
    });

    prisma.bookAuthor.count.mockResolvedValue(0);
    prisma.author.update.mockResolvedValue({ id: 1, name: 'C' });
    await service.update(1, { name: 'C' });
    await service.remove(1);
    expect(prisma.author.delete).toHaveBeenCalled();
  });
});
