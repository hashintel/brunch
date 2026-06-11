ALTER TABLE `elicitation_gaps` ADD `refers_to` text NOT NULL;--> statement-breakpoint
ALTER TABLE `elicitation_gaps` ADD `question` text NOT NULL;--> statement-breakpoint
ALTER TABLE `elicitation_gaps` DROP COLUMN `name`;