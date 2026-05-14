-- 1. Create thread table
CREATE TABLE `thread` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`kind` text NOT NULL,
	`target_item_id` integer,
	`context_spec` text,
	`kickoff_turn_id` integer,
	`invoked_in_turn_id` integer,
	`active_turn_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kickoff_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoked_in_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- 2. Partial unique index: exactly one interview thread per chat
CREATE UNIQUE INDEX `thread_interview_unique` ON `thread` (`chat_id`) WHERE kind = 'interview';--> statement-breakpoint

-- 3. Seed one interview thread per existing chat
INSERT INTO `thread` (`chat_id`, `kind`, `active_turn_id`)
SELECT `id`, 'interview', `active_turn_id` FROM `chat`;--> statement-breakpoint

-- 4. Recreate turn with thread_id instead of chat_id
CREATE TABLE `turn_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`thread_id` integer NOT NULL,
	`parent_turn_id` integer,
	`phase` text NOT NULL,
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
SELECT t.`id`, t.`specification_id`, th.`id`, t.`parent_turn_id`, t.`phase`, t.`turn_kind`, t.`question`, t.`why`, t.`impact`, t.`answer`, t.`is_resolution`, t.`user_parts`, t.`assistant_parts`, t.`created_at`
FROM `turn` t
JOIN `thread` th ON th.`chat_id` = t.`chat_id` AND th.`kind` = 'interview';--> statement-breakpoint
DROP TABLE `turn`;--> statement-breakpoint
ALTER TABLE `turn_new` RENAME TO `turn`;--> statement-breakpoint

-- 5. Recreate chat without kind and active_turn_id
CREATE TABLE `chat_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`specification_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`specification_id`) REFERENCES `specification`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `chat_new` (`id`, `specification_id`, `created_at`)
SELECT `id`, `specification_id`, `created_at` FROM `chat`;--> statement-breakpoint
DROP TABLE `chat`;--> statement-breakpoint
ALTER TABLE `chat_new` RENAME TO `chat`;
