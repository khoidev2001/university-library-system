import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';

/** "Khoa học máy tính" → "khoa-hoc-may-tinh" */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<(Category & { bookCount: number })[]> {
    return this.prisma.category
      .findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { books: true } } },
      })
      .then((rows) =>
        rows.map(({ _count, ...c }) => ({ ...c, bookCount: _count.books })),
      );
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ?? slugify(dto.name);
    const clash = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (clash)
      throw new BusinessException('CATEGORY_EXISTS', 'Thể loại đã tồn tại');
    return this.prisma.category.create({ data: { name: dto.name, slug } });
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    await this.getOrThrow(id);
    const data = {
      name: dto.name,
      slug: dto.slug ?? (dto.name ? slugify(dto.name) : undefined),
    };
    const clash = await this.prisma.category.findFirst({
      where: {
        id: { not: id },
        OR: [{ name: data.name ?? '' }, { slug: data.slug ?? '' }],
      },
    });
    if (clash)
      throw new BusinessException('CATEGORY_EXISTS', 'Thể loại đã tồn tại');
    return this.prisma.category.update({ where: { id }, data });
  }

  /** BR-12: không xoá thể loại còn sách. */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    const books = await this.prisma.book.count({ where: { categoryId: id } });
    if (books > 0)
      throw new BusinessException(
        'CATEGORY_IN_USE',
        `Thể loại đang có ${books} sách`,
      );
    await this.prisma.category.delete({ where: { id } });
  }

  private async getOrThrow(id: number): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy thể loại');
    return category;
  }
}
