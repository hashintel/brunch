ALTER TABLE `edges` ADD `settlement` text DEFAULT 'settled' NOT NULL;--> statement-breakpoint
ALTER TABLE `nodes` ADD `settlement` text DEFAULT 'settled' NOT NULL;