/*
  Warnings:

  - You are about to drop the `notification_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN "notificationPrefs" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "notification_settings";
PRAGMA foreign_keys=on;
