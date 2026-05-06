CREATE TABLE `chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`kind` text NOT NULL,
	`active_turn_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`specification_id`) REFERENCES `specification`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `chat` (`specification_id`, `kind`, `active_turn_id`)
SELECT `id`, 'interview', `active_turn_id` FROM `specification`;
