import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { contentDisposition } from '../../common/http/content-disposition';
import { BusinessException } from '../../common/exceptions/business.exception';
import { CATALOG_CACHE } from '../../common/cache-control';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CopiesService } from '../copies/copies.service';
import { CreateCopyDto } from '../copies/dto/copies.dto';
import { BooksService } from './books.service';
import {
  ImportFileQueryDto,
  ImportTemplateQueryDto,
} from './import/book-import.dto';
import { BookImportService } from './import/book-import.service';
import {
  importTemplateCsv,
  importTemplateXlsx,
} from './import/book-import.template';
import { IMPORT_MAX_FILE_BYTES } from './import/book-import.types';
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
    private readonly bookImport: BookImportService,
  ) {}

  @Public()
  @Get()
  @Header('Cache-Control', CATALOG_CACHE)
  @ApiOperation({
    summary:
      'Tìm kiếm sách theo tiêu đề / tác giả / ISBN, lọc thể loại, tác giả, còn sách',
  })
  search(@Query() query: QueryBooksDto) {
    return this.books.search(query);
  }

  @Get('import-template')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary:
      'Tải file mẫu nhập sách (CSV UTF-8 có BOM hoặc xlsx) kèm dòng ví dụ',
  })
  async importTemplate(
    @Query() query: ImportTemplateQueryDto,
    @Res() res: Response,
  ) {
    const xlsx = query.format === 'xlsx';
    res.setHeader(
      'Content-Type',
      xlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      contentDisposition(`Mẫu nhập sách.${query.format}`),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(xlsx ? await importTemplateXlsx() : importTemplateCsv());
  }

  @Post('import-file')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: IMPORT_MAX_FILE_BYTES,
        files: 1,
        fields: 0,
        parts: 2,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Nhập sách hàng loạt từ file CSV / xlsx (tối đa 5 MB, 5000 dòng). dryRun=true chỉ xem trước, không ghi',
    description:
      'Cột: title, authors (cách nhau bằng ;), category, isbn, publisher, publishedYear, price, description, ' +
      'coverUrl, copies, shelfLocation. Idempotent theo ISBN. Trả ImportPreview khi dryRun=true, ImportReport khi ghi thật.',
  })
  @ApiResponse({
    status: 413,
    description: 'File quá 5 MB (hoặc giải nén quá lớn): IMPORT_FILE_TOO_LARGE',
  })
  @ApiResponse({
    status: 415,
    description:
      'Không phải CSV / xlsx, hoặc có macro: IMPORT_FILE_TYPE_INVALID | IMPORT_MACRO_NOT_ALLOWED',
  })
  @ApiResponse({
    status: 422,
    description:
      'IMPORT_TOO_MANY_ROWS | IMPORT_MALFORMED | IMPORT_MISSING_COLUMN | IMPORT_EMPTY | IMPORT_ENCODING',
  })
  async importFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() query: ImportFileQueryDto,
  ) {
    if (!file)
      throw new BusinessException(
        'IMPORT_NO_FILE',
        'Chưa chọn file (trường multipart "file")',
        400,
      );
    if (query.dryRun)
      return this.bookImport.toPreview(
        await this.bookImport.analyze(
          file.buffer,
          file.originalname,
          query.onDuplicate,
        ),
      );
    return this.bookImport.run(
      file.buffer,
      file.originalname,
      query.onDuplicate,
    );
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
  @Header('Cache-Control', CATALOG_CACHE)
  @ApiOperation({
    summary: 'Chi tiết sách: tác giả, thể loại, số bản còn, điểm đánh giá',
  })
  findOne(@Param('id', ParseIdPipe) id: number) {
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
  update(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.books.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá đầu sách (không còn bản đang mượn)' })
  @ApiResponse({
    status: 409,
    description: 'BOOK_HAS_ACTIVE_LOANS | BOOK_HAS_LOAN_HISTORY',
  })
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.books.remove(id);
  }

  @Get(':id/copies')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Danh sách bản sao của đầu sách' })
  listCopies(@Param('id', ParseIdPipe) id: number) {
    return this.copies.findByBook(id);
  }

  @Post(':id/copies')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Thêm bản sao (barcode duy nhất, trạng thái AVAILABLE)',
  })
  @ApiResponse({ status: 409, description: 'BARCODE_EXISTS' })
  createCopy(@Param('id', ParseIdPipe) id: number, @Body() dto: CreateCopyDto) {
    return this.copies.create(id, dto);
  }
}
