-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "businessId" TEXT;

-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "settlementWalletId" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "settlementWalletId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "settlementWalletId" TEXT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "businessId" TEXT;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "businessId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "businessId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "importedFromWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementWallet" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'current',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "legacyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "address" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "xdr" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "homeDomain" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAudit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "previousAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Business_importedFromWallet_key" ON "Business"("importedFromWallet");

-- CreateIndex
CREATE INDEX "Membership_businessId_idx" ON "Membership"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementWallet_address_key" ON "SettlementWallet"("address");

-- CreateIndex
CREATE INDEX "SettlementWallet_businessId_isDefault_idx" ON "SettlementWallet"("businessId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "WalletChallenge_nonce_key" ON "WalletChallenge"("nonce");

-- CreateIndex
CREATE INDEX "WalletChallenge_userId_expiresAt_idx" ON "WalletChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletChallenge_businessId_idx" ON "WalletChallenge"("businessId");

-- CreateIndex
CREATE INDEX "WalletAudit_businessId_createdAt_idx" ON "WalletAudit"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_businessId_key" ON "Merchant"("businessId");

-- CreateIndex
CREATE INDEX "PaymentLink_businessId_idx" ON "PaymentLink"("businessId");

-- CreateIndex
CREATE INDEX "Plan_businessId_idx" ON "Plan"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_businessId_idx" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_businessId_idx" ON "WebhookEndpoint"("businessId");

-- CreateIndex
CREATE INDEX "ApiKey_businessId_idx" ON "ApiKey"("businessId");

-- CreateIndex
CREATE INDEX "Event_businessId_createdAt_idx" ON "Event"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementWallet" ADD CONSTRAINT "SettlementWallet_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletChallenge" ADD CONSTRAINT "WalletChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletChallenge" ADD CONSTRAINT "WalletChallenge_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAudit" ADD CONSTRAINT "WalletAudit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAudit" ADD CONSTRAINT "WalletAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_settlementWalletId_fkey" FOREIGN KEY ("settlementWalletId") REFERENCES "SettlementWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_settlementWalletId_fkey" FOREIGN KEY ("settlementWalletId") REFERENCES "SettlementWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_settlementWalletId_fkey" FOREIGN KEY ("settlementWalletId") REFERENCES "SettlementWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Additive legacy ownership backfill. IDs are deterministic so a migration
-- recovery/re-run cannot create a second Business for the same wallet. Email is
-- deliberately excluded: existing records are claimed only by wallet proof.
WITH legacy_addresses AS (
    SELECT "address" FROM "Merchant"
    UNION SELECT "merchant" FROM "PaymentLink"
    UNION SELECT "merchant" FROM "Plan"
    UNION SELECT "merchant" FROM "Subscription"
    UNION SELECT "merchant" FROM "WebhookEndpoint"
    UNION SELECT "merchant" FROM "ApiKey"
)
INSERT INTO "Business" ("id", "name", "importedFromWallet", "createdAt", "updatedAt")
SELECT
    'legacy_business_' || md5(a."address"),
    COALESCE(NULLIF(m."displayName", ''), 'Imported Business'),
    a."address",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM legacy_addresses a
LEFT JOIN "Merchant" m ON m."address" = a."address"
WHERE a."address" IS NOT NULL AND a."address" <> ''
ON CONFLICT ("importedFromWallet") DO NOTHING;

INSERT INTO "SettlementWallet" (
    "id", "businessId", "address", "status", "isDefault", "verifiedAt", "createdAt", "updatedAt"
)
SELECT
    'legacy_wallet_' || md5(b."importedFromWallet"),
    b."id",
    b."importedFromWallet",
    'current',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Business" b
WHERE b."importedFromWallet" IS NOT NULL
ON CONFLICT ("address") DO NOTHING;

UPDATE "Merchant" r SET "businessId" = b."id"
FROM "Business" b WHERE b."importedFromWallet" = r."address" AND r."businessId" IS NULL;

UPDATE "PaymentLink" r SET
    "businessId" = w."businessId", "settlementWalletId" = w."id"
FROM "SettlementWallet" w
WHERE w."address" = r."merchant" AND (r."businessId" IS NULL OR r."settlementWalletId" IS NULL);

UPDATE "Plan" r SET
    "businessId" = w."businessId", "settlementWalletId" = w."id"
FROM "SettlementWallet" w
WHERE w."address" = r."merchant" AND (r."businessId" IS NULL OR r."settlementWalletId" IS NULL);

UPDATE "Subscription" r SET
    "businessId" = w."businessId", "settlementWalletId" = w."id"
FROM "SettlementWallet" w
WHERE w."address" = r."merchant" AND (r."businessId" IS NULL OR r."settlementWalletId" IS NULL);

UPDATE "WebhookEndpoint" r SET "businessId" = w."businessId"
FROM "SettlementWallet" w WHERE w."address" = r."merchant" AND r."businessId" IS NULL;

UPDATE "ApiKey" r SET "businessId" = w."businessId"
FROM "SettlementWallet" w WHERE w."address" = r."merchant" AND r."businessId" IS NULL;

UPDATE "Event" e SET "businessId" = COALESCE(p."businessId", s."businessId")
FROM "Event" source
LEFT JOIN "PaymentLink" p ON p."id" = source."paymentLinkId"
LEFT JOIN "Subscription" s ON s."id" = source."subscriptionId"
WHERE e."id" = source."id" AND e."businessId" IS NULL
  AND COALESCE(p."businessId", s."businessId") IS NOT NULL;

-- Older subscription-created events predate the subscription relation but
-- carry the immutable on-chain plan id. Use it when the plan still exists;
-- truly orphaned historical events remain nullable rather than guessed.
UPDATE "Event" e SET "businessId" = p."businessId"
FROM "Plan" p
WHERE e."businessId" IS NULL
  AND e."data"->>'planId' = p."onChainId"
  AND p."businessId" IS NOT NULL;
