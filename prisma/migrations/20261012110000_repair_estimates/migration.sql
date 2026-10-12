ALTER TABLE "Repair" ADD COLUMN "estimatedCostPence" INTEGER;
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_estimatedCost_nonnegative" CHECK ("estimatedCostPence" IS NULL OR "estimatedCostPence" >= 0);
