PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`turn_id` integer NOT NULL,
	`position` integer NOT NULL,
	`content` text NOT NULL,
	`is_recommended` integer DEFAULT false NOT NULL,
	`is_selected` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_option`("id", "turn_id", "position", "content", "is_recommended", "is_selected") SELECT "id", "turn_id", "position", "content", "is_recommended", "is_selected" FROM `option`;--> statement-breakpoint
DROP TABLE `option`;--> statement-breakpoint
ALTER TABLE `__new_option` RENAME TO `option`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `option_turn_position_unique` ON `option` (`turn_id`,`position`);--> statement-breakpoint
CREATE TABLE `__new_turn` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`parent_turn_id` integer,
	`phase` text NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`why` text,
	`impact` text,
	`answer` text,
	`is_resolution` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_turn`("id", "project_id", "parent_turn_id", "phase", "question", "why", "impact", "answer", "is_resolution", "created_at") SELECT "id", "project_id", "parent_turn_id", "phase", "question", "why", "impact", "answer", "is_resolution", "created_at" FROM `turn`;--> statement-breakpoint
DROP TABLE `turn`;--> statement-breakpoint
ALTER TABLE `__new_turn` RENAME TO `turn`;