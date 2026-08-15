-- Adds the Assessment 3 metrics dimensions to RequestLog.
-- `outcome` is backfilled from the existing `status` column before being
-- made NOT NULL, since rows already exist from Assessment 2 traffic.
ALTER TABLE "RequestLog" ADD COLUMN "clientId" TEXT;
ALTER TABLE "RequestLog" ADD COLUMN "feedId" INTEGER;
ALTER TABLE "RequestLog" ADD COLUMN "outcome" TEXT;

UPDATE "RequestLog" SET "outcome" = CASE WHEN "status" < 400 THEN 'ok' ELSE 'error' END;

ALTER TABLE "RequestLog" ALTER COLUMN "outcome" SET NOT NULL;

CREATE INDEX "RequestLog_feedId_idx" ON "RequestLog"("feedId");
CREATE INDEX "RequestLog_clientId_idx" ON "RequestLog"("clientId");
