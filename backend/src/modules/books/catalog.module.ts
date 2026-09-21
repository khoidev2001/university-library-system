import { Module } from '@nestjs/common';
import { AuthorsController } from '../authors/authors.controller';
import { AuthorsService } from '../authors/authors.service';
import { CategoriesController } from '../categories/categories.controller';
import { CategoriesService } from '../categories/categories.service';
import { CopiesController } from '../copies/copies.controller';
import { CopiesService } from '../copies/copies.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { GoogleBooksClient } from './google-books.client';

/** F2 + F5: sách, tác giả, thể loại, bản sao — một module vì dùng chung entity Book. */
@Module({
  controllers: [
    BooksController,
    AuthorsController,
    CategoriesController,
    CopiesController,
  ],
  providers: [
    BooksService,
    AuthorsService,
    CategoriesService,
    CopiesService,
    GoogleBooksClient,
  ],
  exports: [BooksService, CopiesService, GoogleBooksClient],
})
export class CatalogModule {}
