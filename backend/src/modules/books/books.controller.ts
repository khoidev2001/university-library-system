import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CopiesService } from '../copies/copies.service';
import { CreateCopyDto } from '../copies/dto/copies.dto';
import { BooksService } from './books.service';
import {
  CreateBookDto,
  ImportBooksDto,
  QueryBooksDto,
  UpdateBookDto,
} from './dto/books.dto';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly copies: CopiesService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Tìm kiếm sách theo tiêu đề / tác giả / ISBN, lọc thể loại, tác giả, còn sách',
  })
  search(@Query() query: QueryBooksDto) {
    return this.books.search(query);
  }

  @Post('import')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Nhập sách hàng loạt theo ISBN qua Google Books (FR-BOOK-05)',
  })
  importByIsbn(@Body() dto: ImportBooksDto) {
    return this.books.importByIsbn(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết sách: tác giả, thể loại, số bản còn, điểm đánh giá',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.books.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Thêm đầu sách' })
  @ApiResponse({ status: 409, description: 'ISBN_EXISTS' })
  create(@Body() dto: CreateBookDto) {
    return this.books.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Sửa đầu sách' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.books.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá đầu sách (không còn bản đang mượn)' })
  @ApiResponse({ status: 409, description: 'BOOK_HAS_ACTIVE_LOANS' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.books.remove(id);
  }

  @Get(':id/copies')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Danh sách bản sao của đầu sách' })
  listCopies(@Param('id', ParseIntPipe) id: number) {
    return this.copies.findByBook(id);
  }

  @Post(':id/copies')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Thêm bản sao (barcode duy nhất, trạng thái AVAILABLE)',
  })
  @ApiResponse({ status: 409, description: 'BARCODE_EXISTS' })
  createCopy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCopyDto,
  ) {
    return this.copies.create(id, dto);
  }
}
