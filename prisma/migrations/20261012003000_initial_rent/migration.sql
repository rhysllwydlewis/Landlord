ALTER TABLE "Tenancy" ADD COLUMN "initialRentPence" INTEGER;
-- Preserve the original scheduled rent separately from the current displayed rent.
UPDATE "Tenancy" t SET "initialRentPence" = COALESCE(
  (SELECT o."amountPence" FROM "RentObligation" o
   WHERE o."tenancyId" = t.id AND o."scheduleKey" LIKE 'rent:%'
   ORDER BY o."dueDate" ASC LIMIT 1), t."rentPence");
ALTER TABLE "Tenancy" ALTER COLUMN "initialRentPence" SET NOT NULL;
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_initial_rent_positive" CHECK ("initialRentPence" > 0);
