ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_positive" CHECK ("amountPence" > 0);
ALTER TABLE "RentObligation" ADD CONSTRAINT "rent_amount_nonnegative" CHECK ("amountPence" >= 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "allocation_amount_positive" CHECK ("amountPence" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "expense_amount_positive" CHECK ("amountPence" > 0);
ALTER TABLE "Tenancy" ADD CONSTRAINT "tenancy_rent_positive" CHECK ("rentPence" > 0), ADD CONSTRAINT "tenancy_deposit_nonnegative" CHECK ("depositPence" >= 0), ADD CONSTRAINT "tenancy_dates_valid" CHECK ("endDate" IS NULL OR "endDate" >= "startDate"), ADD CONSTRAINT "tenancy_due_day_valid" CHECK ("dueDay" BETWEEN 1 AND 31);
ALTER TABLE "Deposit" ADD CONSTRAINT "deposit_return_valid" CHECK ("amountPence" >= 0 AND "returnedPence" >= 0 AND "returnedPence" <= "amountPence");
ALTER TABLE "Document" ADD CONSTRAINT "document_size_positive" CHECK ("size" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "property_rooms_nonnegative" CHECK ("bedrooms" >= 0 AND "bathrooms" >= 0);
CREATE FUNCTION validate_payment_allocation() RETURNS trigger AS $$
DECLARE p "Payment"%ROWTYPE; o "RentObligation"%ROWTYPE;
BEGIN
  SELECT * INTO p FROM "Payment" WHERE id=NEW."paymentId" FOR UPDATE;
  SELECT * INTO o FROM "RentObligation" WHERE id=NEW."obligationId" FOR UPDATE;
  IF p."tenancyId" <> o."tenancyId" OR p."organisationId" <> o."organisationId" THEN
    RAISE EXCEPTION 'Allocation must belong to the same tenancy and organisation';
  END IF;
  IF (SELECT COALESCE(SUM("amountPence"),0) FROM "PaymentAllocation" WHERE "paymentId"=p.id) > p."amountPence" THEN
    RAISE EXCEPTION 'Payment is overallocated';
  END IF;
  IF (SELECT COALESCE(SUM("amountPence"),0) FROM "PaymentAllocation" WHERE "obligationId"=o.id) > o."amountPence" THEN
    RAISE EXCEPTION 'Obligation is overallocated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER payment_allocation_integrity AFTER INSERT OR UPDATE ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation();
