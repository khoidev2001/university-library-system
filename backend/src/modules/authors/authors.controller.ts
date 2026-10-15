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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CATALOG_CACHE } from '../../common/cache-control';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthorsService } from './authors.service';
import { AuthorDto, QueryAuthorsDto } from './dto/authors.dto';

@ApiTags('authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', CATALOG_CACHE)
  @ApiOperation({ summary: 'Danh sách tác giả (tìm theo tên, phân trang)' })
  findAll(@Query() query: QueryAuthorsDto) {
    return this.authors.findAll(query);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  create(@Body() dto: AuthorDto) {
    return this.authors.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  update(@Param('id', ParseIdPipe) id: number, @Body() dto: AuthorDto) {
    return this.authors.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @HttpCode(204)
  @ApiResponse({ status: 409, description: 'AUTHOR_IN_USE' })
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.authors.remove(id);
  }
}
