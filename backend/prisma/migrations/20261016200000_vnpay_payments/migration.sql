-- Thanh toán phạt trực tuyến qua VNPay: giao dịch + bảng nối với khoản phạt.

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "txn_ref" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "vnp_transaction_no" TEXT,
    "bank_code" TEXT,
    "response_code" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_fines" (
    "payment_id" INTEGER NOT NULL,
    "fine_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_fines_pkey" PRIMARY KEY ("payment_id","fine_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_txn_ref_key" ON "payments"("txn_ref");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_expires_at_idx" ON "payments"("status", "expires_at");

-- CreateIndex
CREATE INDEX "payment_fines_fine_id_idx" ON "payment_fines"("fine_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_fines" ADD CONSTRAINT "payment_fines_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_fines" ADD CONSTRAINT "payment_fines_fine_id_fkey" FOREIGN KEY ("fine_id") REFERENCES "fines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Số tiền phải dương (VNPay không nhận 0).
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);

-- Một khoản phạt chỉ thuộc tối đa MỘT giao dịch đang chờ hoặc đã thanh toán (active = true).
-- Hai yêu cầu tạo giao dịch đồng thời cho cùng khoản phạt: một bên vi phạm chỉ mục này (P2002).
-- Giao dịch FAILED / EXPIRED / CANCELLED đặt active = false để nhả khoản phạt.
CREATE UNIQUE INDEX "payment_fines_active_fine_key" ON "payment_fines"("fine_id") WHERE "active";
