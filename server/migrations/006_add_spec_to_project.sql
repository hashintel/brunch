-- Migration 006: Add spec and spec_progress columns to project table
ALTER TABLE `project` ADD COLUMN `spec` LONGTEXT;
ALTER TABLE `project` ADD COLUMN `spec_progress` INT NOT NULL DEFAULT 0;
