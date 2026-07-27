CREATE TABLE `reconciliation_need` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`source_item_id` integer NOT NULL,
	`target_item_id` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reason` text,
	`caused_by_turn_id` integer,
	`caused_by_patch_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`specification_id`) REFERENCES `specification`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caused_by_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reconciliation_need_open_unique`
	ON `reconciliation_need` (`source_item_id`, `target_item_id`, `kind`)
	WHERE status = 'open';
