import { Injectable, NotFoundException } from '@nestjs/common';
import { Author, Prisma } from '@prisma/client';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorDto, QueryAuthorsDto } from './dto/authors.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryAuthorsDto,
  ): Promise<Page<Author & { bookCount: number }>> {
    const where: Prisma.AuthorWhereInput = query.q
      ? { name: { contains: query.q, mode: 'insensitive' } }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.author.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
        include: { _count: { select: { books: true } } },
      }),
      this.prisma.author.count({ where }),
    ]);
    return toPage(
      rows.map(({ _count, ...a }) => ({ ...a, bookCount: _count.books })),
      total,
      query,
    );
  }

  create(dto: AuthorDto): Promise<Author> {
    return this.prisma.author.create({ data: { name: dto.name.trim() } });
  }

  async update(id: number, dto: AuthorDto): Promise<Author> {
    await this.getOrThrow(id);
    return this.prisma.author.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
  }

  /** Không xoá tác giả còn sách (cùng tinh thần BR-12). */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    const books = await this.prisma.bookAuthor.count({
      where: { authorId: id },
    });
    if (books > 0)
      throw new BusinessException(
        'AUTHOR_IN_USE',
        `Tác giả đang có ${books} sách`,
      );
    await this.prisma.author.delete({ where: { id } });
  }

  private async getOrThrow(id: number): Promise<Author> {
    const author = await this.prisma.author.findUnique({ where: { id } });
    if (!author) throw new NotFoundException('Không tìm thấy tác giả');
    return author;
  }
}
