-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF', 'TENANT', 'STAKEHOLDER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platformAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "jurisdiction" TEXT NOT NULL DEFAULT 'England',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tenantId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipEntity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "companyNumber" TEXT,

    CONSTRAINT "OwnershipEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "portfolioId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'house',
    "jurisdiction" TEXT NOT NULL DEFAULT 'England',
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "bathrooms" INTEGER NOT NULL DEFAULT 0,
    "furnishing" TEXT NOT NULL DEFAULT 'unfurnished',
    "epcRating" TEXT,
    "purchasePricePence" INTEGER,
    "valuePence" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'room',
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "reference" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rentPence" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    "depositPence" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyParticipant" (
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenancyParticipant_pkey" PRIMARY KEY ("tenancyId","tenantId")
);

-- CreateTable
CREATE TABLE "RentObligation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Rent',
    "scheduleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank transfer',
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenancyId" TEXT,
    "reportedByTenantId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'reported',
    "source" TEXT NOT NULL DEFAULT 'landlord',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "tenantComments" BOOLEAN NOT NULL DEFAULT true,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "issueStartedAt" DATE,
    "ongoing" BOOLEAN NOT NULL DEFAULT true,
    "targetDate" DATE,
    "completedAt" TIMESTAMP(3),
    "completionSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairAccess" (
    "organisationId" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "RepairAccess_pkey" PRIMARY KEY ("repairId","tenantId")
);

-- CreateTable
CREATE TABLE "RepairUpdate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairComment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "repairId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "invoiceReference" TEXT NOT NULL DEFAULT '',
    "amountPence" INTEGER NOT NULL,
    "incurredAt" DATE NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "repairId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccess" (
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DocumentAccess_pkey" PRIMARY KEY ("documentId","tenantId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "participantUserIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "propertyTypes" TEXT[],
    "version" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceUrl" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "repairId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" DATE NOT NULL,
    "assignedToUserId" TEXT,
    "recurrenceDays" INTEGER,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "receivedAt" DATE,
    "scheme" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'not recorded',
    "returnedPence" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAsset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "installedAt" DATE,
    "lastServiceAt" DATE,
    "serviceIntervalMonths" INTEGER NOT NULL DEFAULT 12,
    "warrantyExpiresAt" DATE,
    "replacementAt" DATE,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PropertyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rentPence" INTEGER NOT NULL,
    "depositPence" INTEGER NOT NULL,
    "availableAt" DATE NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "details" JSONB NOT NULL DEFAULT '{}',
    "referencingStatus" TEXT NOT NULL DEFAULT 'not started',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPence" INTEGER NOT NULL,
    "annualPence" INTEGER NOT NULL,
    "propertyLimit" INTEGER NOT NULL,
    "unitLimit" INTEGER NOT NULL,
    "staffLimit" INTEGER NOT NULL,
    "storageBytes" BIGINT NOT NULL,
    "features" TEXT[],
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "stripeMonthlyPriceId" TEXT,
    "stripeAnnualPriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "developmentOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "rows" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Membership_userId_active_idx" ON "Membership"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organisationId_userId_key" ON "Membership"("organisationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organisationId_email_idx" ON "Invitation"("organisationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_id_organisationId_key" ON "Portfolio"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_organisationId_name_key" ON "Portfolio"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipEntity_id_organisationId_key" ON "OwnershipEntity"("id", "organisationId");

-- CreateIndex
CREATE INDEX "Property_organisationId_archivedAt_idx" ON "Property"("organisationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_id_organisationId_key" ON "Property"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_id_organisationId_key" ON "Unit"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_name_key" ON "Unit"("propertyId", "name");

-- CreateIndex
CREATE INDEX "Tenant_userId_idx" ON "Tenant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_organisationId_key" ON "Tenant"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_organisationId_email_key" ON "Tenant"("organisationId", "email");

-- CreateIndex
CREATE INDEX "Tenancy_organisationId_status_idx" ON "Tenancy"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tenancy_id_organisationId_key" ON "Tenancy"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenancy_organisationId_reference_key" ON "Tenancy"("organisationId", "reference");

-- CreateIndex
CREATE INDEX "TenancyParticipant_tenantId_idx" ON "TenancyParticipant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RentObligation_scheduleKey_key" ON "RentObligation"("scheduleKey");

-- CreateIndex
CREATE INDEX "RentObligation_organisationId_dueDate_idx" ON "RentObligation"("organisationId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RentObligation_id_organisationId_key" ON "RentObligation"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_organisationId_paidAt_idx" ON "Payment"("organisationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_organisationId_key" ON "Payment"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_obligationId_key" ON "PaymentAllocation"("paymentId", "obligationId");

-- CreateIndex
CREATE INDEX "Repair_organisationId_status_priority_idx" ON "Repair"("organisationId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Repair_id_organisationId_key" ON "Repair"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Repair_organisationId_reference_key" ON "Repair"("organisationId", "reference");

-- CreateIndex
CREATE INDEX "Expense_organisationId_incurredAt_idx" ON "Expense"("organisationId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_organisationId_category_idx" ON "Document"("organisationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_organisationId_key" ON "Document"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_id_organisationId_key" ON "Conversation"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_organisationId_userId_readAt_idx" ON "Notification"("organisationId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "ComplianceRecord_organisationId_expiresAt_idx" ON "ComplianceRecord"("organisationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRule_name_jurisdiction_version_key" ON "ComplianceRule"("name", "jurisdiction", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Task_dedupeKey_key" ON "Task"("dedupeKey");

-- CreateIndex
CREATE INDEX "Task_organisationId_status_dueDate_idx" ON "Task"("organisationId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_tenancyId_key" ON "Deposit"("tenancyId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_tenancyId_organisationId_key" ON "Deposit"("tenancyId", "organisationId");

-- CreateIndex
CREATE INDEX "PropertyAsset_organisationId_propertyId_idx" ON "PropertyAsset"("organisationId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_id_organisationId_key" ON "Listing"("id", "organisationId");

-- CreateIndex
CREATE INDEX "Application_organisationId_status_idx" ON "Application"("organisationId", "status");

-- CreateIndex
CREATE INDEX "OperationRecord_organisationId_kind_idx" ON "OperationRecord"("organisationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_dedupeKey_key" ON "BackgroundJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_runAt_idx" ON "BackgroundJob"("status", "runAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipEntity" ADD CONSTRAINT "OwnershipEntity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_portfolioId_organisationId_fkey" FOREIGN KEY ("portfolioId", "organisationId") REFERENCES "Portfolio"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_organisationId_fkey" FOREIGN KEY ("ownerId", "organisationId") REFERENCES "OwnershipEntity"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_unitId_organisationId_fkey" FOREIGN KEY ("unitId", "organisationId") REFERENCES "Unit"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyParticipant" ADD CONSTRAINT "TenancyParticipant_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyParticipant" ADD CONSTRAINT "TenancyParticipant_tenantId_organisationId_fkey" FOREIGN KEY ("tenantId", "organisationId") REFERENCES "Tenant"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentObligation" ADD CONSTRAINT "RentObligation_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_organisationId_fkey" FOREIGN KEY ("paymentId", "organisationId") REFERENCES "Payment"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_obligationId_organisationId_fkey" FOREIGN KEY ("obligationId", "organisationId") REFERENCES "RentObligation"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_unitId_organisationId_fkey" FOREIGN KEY ("unitId", "organisationId") REFERENCES "Unit"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_reportedByTenantId_organisationId_fkey" FOREIGN KEY ("reportedByTenantId", "organisationId") REFERENCES "Tenant"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairAccess" ADD CONSTRAINT "RepairAccess_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairAccess" ADD CONSTRAINT "RepairAccess_tenantId_organisationId_fkey" FOREIGN KEY ("tenantId", "organisationId") REFERENCES "Tenant"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairUpdate" ADD CONSTRAINT "RepairUpdate_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairComment" ADD CONSTRAINT "RepairComment_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_documentId_organisationId_fkey" FOREIGN KEY ("documentId", "organisationId") REFERENCES "Document"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_tenantId_organisationId_fkey" FOREIGN KEY ("tenantId", "organisationId") REFERENCES "Tenant"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_organisationId_fkey" FOREIGN KEY ("conversationId", "organisationId") REFERENCES "Conversation"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRecord" ADD CONSTRAINT "ComplianceRecord_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_repairId_organisationId_fkey" FOREIGN KEY ("repairId", "organisationId") REFERENCES "Repair"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAsset" ADD CONSTRAINT "PropertyAsset_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_listingId_organisationId_fkey" FOREIGN KEY ("listingId", "organisationId") REFERENCES "Listing"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRecord" ADD CONSTRAINT "OperationRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRecord" ADD CONSTRAINT "OperationRecord_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRecord" ADD CONSTRAINT "OperationRecord_tenancyId_organisationId_fkey" FOREIGN KEY ("tenancyId", "organisationId") REFERENCES "Tenancy"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
