-- AlterTable
ALTER TABLE "ComplianceRecord" ADD COLUMN     "replacesId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "ownerVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RentChange" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "rentPence" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentChange_tenancyId_effectiveFrom_key" ON "RentChange"("tenancyId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRecord_id_organisationId_key" ON "ComplianceRecord"("id", "organisationId");

-- AddForeignKey
ALTER TABLE "ComplianceRecord" ADD CONSTRAINT "ComplianceRecord_replacesId_organisationId_fkey" FOREIGN KEY ("replacesId", "organisationId") REFERENCES "ComplianceRecord"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentChange" ADD CONSTRAINT "RentChange_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
