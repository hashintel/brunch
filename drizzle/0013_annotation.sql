CREATE TABLE `annotation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`knowledge_item_id` integer NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`selection_start` integer,
	`selection_end` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`specification_id`) REFERENCES `specification`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`knowledge_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE cascade
);
