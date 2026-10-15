-- Chỉ mục hiệu năng từ đợt rà soát backend (số liệu EXPLAIN ANALYZE trên 50k sách / 600k phiếu mượn / 1M đánh giá).
-- pg_trgm là extension "trusted" từ PostgreSQL 13: chủ cơ sở dữ liệu (Neon, Render) tạo được, không cần superuser.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- DropIndex
DROP INDEX "books_title_idx";

-- DropIndex
DROP INDEX "loans_due_at_idx";

-- CreateIndex
CREATE INDEX "authors_name_trgm_idx" ON "authors" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "book_authors_author_id_idx" ON "book_authors"("author_id");

-- CreateIndex
CREATE INDEX "book_copies_book_id_status_idx" ON "book_copies"("book_id", "status");

-- CreateIndex
CREATE INDEX "books_title_trgm_idx" ON "books" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "books_isbn_trgm_idx" ON "books" USING GIN ("isbn" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "books_category_id_idx" ON "books"("category_id");

-- CreateIndex
CREATE INDEX "fines_loan_id_idx" ON "fines"("loan_id");

-- CreateIndex
CREATE INDEX "loans_copy_id_idx" ON "loans"("copy_id");

-- CreateIndex
CREATE INDEX "loans_status_due_at_idx" ON "loans"("status", "due_at");

-- CreateIndex
CREATE INDEX "loans_borrowed_at_idx" ON "loans"("borrowed_at");

-- CreateIndex
CREATE INDEX "ratings_book_id_idx" ON "ratings"("book_id");

-- CreateIndex
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING GIN ("full_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_member_code_trgm_idx" ON "users" USING GIN ("member_code" gin_trgm_ops);
