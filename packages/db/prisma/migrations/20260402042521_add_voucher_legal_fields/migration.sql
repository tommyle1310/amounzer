-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "amountInWords" TEXT,
ADD COLUMN     "attachmentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND',
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
ADD COLUMN     "originalAmount" DECIMAL(18,2),
ADD COLUMN     "originalDocRefs" TEXT,
ADD COLUMN     "partyAddress" TEXT,
ADD COLUMN     "partyFullName" TEXT,
ADD COLUMN     "partyIdNumber" TEXT,
ADD COLUMN     "recordingDate" TIMESTAMP(3),
ADD COLUMN     "voucherBookNo" TEXT;
