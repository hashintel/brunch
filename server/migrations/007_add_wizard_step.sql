-- Migration 007: Add wizard_step column to project table
ALTER TABLE `project` ADD COLUMN `wizard_step` VARCHAR(20);
