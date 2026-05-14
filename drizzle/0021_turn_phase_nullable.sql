-- Make turn.phase nullable so non-interview thread kinds (side, reconciliation,
-- qa, agent_run) can persist turns without an interview phase.

CREATE TABLE `turn_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`thread_id` integer NOT NULL,
	`parent_turn_id` integer,
	`phase` text,
	`turn_kind` text DEFAULT 'question' NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`why` text,
	`impact` text,
	`answer` text,
	`is_resolution` integer DEFAULT false NOT NULL,
	`user_parts` text,
	`assistant_parts` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`specification_id`) REFERENCES `specification`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_turn_id`) REFERENCES `turn_new`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `turn_new` (`id`, `specification_id`, `thread_id`, `parent_turn_id`, `phase`, `turn_kind`, `question`, `why`, `impact`, `answer`, `is_resolution`, `user_parts`, `assistant_parts`, `created_at`)
SELECT `id`, `specification_id`, `thread_id`, `parent_turn_id`, `phase`, `turn_kind`, `question`, `why`, `impact`, `answer`, `is_resolution`, `user_parts`, `assistant_parts`, `created_at`
FROM `turn`;--> statement-breakpoint
DROP TABLE `turn`;--> statement-breakpoint
ALTER TABLE `turn_new` RENAME TO `turn`;
