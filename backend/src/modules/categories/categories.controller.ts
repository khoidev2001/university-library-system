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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { STATIC_CACHE } from '../../common/cache-control';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @Header('Cache-Control', STATIC_CACHE)
  @ApiOperation({ summary: 'Danh sách thể loại kèm số sách' })
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @ApiResponse({ status: 409, description: 'CATEGORY_EXISTS' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  update(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.LIBRARIAN)
  @HttpCode(204)
  @ApiResponse({ status: 409, description: 'CATEGORY_IN_USE' })
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.categories.remove(id);
  }
}
