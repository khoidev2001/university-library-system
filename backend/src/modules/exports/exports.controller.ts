import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  BooksExportQueryDto,
  ExportFormatDto,
  FinesExportQueryDto,
  LoansExportQueryDto,
  ReadersExportQueryDto,
  TopBooksExportQueryDto,
} from './dto/exports.dto';
import { CSV_CONTENT_TYPE, XLSX_CONTENT_TYPE } from './export-format';
import { streamDataset } from './export-streamer';
import { ExportsService } from './exports.service';

const CSV_MIME = 'text/csv';

const FILE_RESPONSE = {
  description:
    'File tải về (CSV UTF-8 có BOM hoặc xlsx), phát trực tiếp theo từng lô. Header: Content-Disposition, ' +
    'X-Total-Count (số dòng khớp), X-Export-Truncated (true nếu vượt trần số dòng và file bị cắt).',
  content: {
    [CSV_MIME]: { schema: { type: 'string' as const } },
    [XLSX_CONTENT_TYPE]: {
      schema: { type: 'string' as const, format: 'binary' },
    },
  },
};

@ApiTags('exports')
@ApiBearerAuth()
@Roles(Role.LIBRARIAN)
@ApiProduces(CSV_CONTENT_TYPE, XLSX_CONTENT_TYPE)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get('overdue-loans')
  @ApiOperation({ summary: 'Xuất phiếu mượn đang quá hạn (kèm phạt ước tính)' })
  @ApiOkResponse(FILE_RESPONSE)
  async overdueLoans(@Query() q: ExportFormatDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.overdueLoans());
  }

  @Get('loans')
  @ApiOperation({
    summary: 'Xuất phiếu mượn theo khoảng ngày mượn / trạng thái / quá hạn',
  })
  @ApiOkResponse(FILE_RESPONSE)
  async loans(@Query() q: LoansExportQueryDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.loans(q));
  }

  @Get('top-books')
  @ApiOperation({ summary: 'Xuất sách được mượn nhiều nhất trong khoảng ngày' })
  @ApiOkResponse(FILE_RESPONSE)
  async topBooks(@Query() q: TopBooksExportQueryDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.topBooks(q));
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Xuất tồn kho theo thể loại' })
  @ApiOkResponse(FILE_RESPONSE)
  async inventory(@Query() q: ExportFormatDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.inventory());
  }

  @Get('fines')
  @ApiOperation({
    summary: 'Xuất khoản phạt theo trạng thái thu / khoảng ngày phát sinh',
  })
  @ApiOkResponse(FILE_RESPONSE)
  async fines(@Query() q: FinesExportQueryDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.fines(q));
  }

  @Get('readers')
  @ApiOperation({ summary: 'Xuất danh sách bạn đọc (kèm số sách đang mượn)' })
  @ApiOkResponse(FILE_RESPONSE)
  async readers(@Query() q: ReadersExportQueryDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.readers(q));
  }

  @Get('books')
  @ApiOperation({ summary: 'Xuất danh mục sách kèm số bản sao' })
  @ApiOkResponse(FILE_RESPONSE)
  async books(@Query() q: BooksExportQueryDto, @Res() res: Response) {
    await streamDataset(res, q.format, await this.exports.books(q));
  }
}
