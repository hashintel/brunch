ALTER TABLE `specs` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `specs` ADD `relates_to_spec_id` integer REFERENCES specs(id);