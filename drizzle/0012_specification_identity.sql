PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `project` RENAME TO `specification`;--> statement-breakpoint
ALTER TABLE `turn` RENAME COLUMN `project_id` TO `specification_id`;--> statement-breakpoint
ALTER TABLE `phase_outcome` RENAME COLUMN `project_id` TO `specification_id`;--> statement-breakpoint
ALTER TABLE `knowledge_item` RENAME COLUMN `project_id` TO `specification_id`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
