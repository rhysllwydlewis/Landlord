CREATE UNIQUE INDEX "Deposit_id_organisationId_key" ON "Deposit"("id", "organisationId");
CREATE TABLE "DepositResponse" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "depositId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "proposalHash" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepositResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DepositResponse_decision_check" CHECK ("decision" IN ('agree','disagree','question')),
  CONSTRAINT "DepositResponse_deposit_fkey" FOREIGN KEY ("depositId", "organisationId") REFERENCES "Deposit"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DepositResponse_tenant_fkey" FOREIGN KEY ("tenantId", "organisationId") REFERENCES "Tenant"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DepositResponse_organisationId_idempotencyKey_key" ON "DepositResponse"("organisationId", "idempotencyKey");
CREATE INDEX "DepositResponse_organisationId_depositId_createdAt_idx" ON "DepositResponse"("organisationId", "depositId", "createdAt");
