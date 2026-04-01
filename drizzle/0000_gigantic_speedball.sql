CREATE TABLE `assumption` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assumption_parent_assumption` (
	`assumption_id` integer NOT NULL,
	`parent_assumption_id` integer NOT NULL,
	PRIMARY KEY(`assumption_id`, `parent_assumption_id`),
	FOREIGN KEY (`assumption_id`) REFERENCES `assumption`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_assumption_id`) REFERENCES `assumption`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `criterion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`requirement_id` integer NOT NULL,
	`content` text NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirement`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`content` text NOT NULL,
	`rationale` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision_parent_assumption` (
	`decision_id` integer NOT NULL,
	`parent_assumption_id` integer NOT NULL,
	PRIMARY KEY(`decision_id`, `parent_assumption_id`),
	FOREIGN KEY (`decision_id`) REFERENCES `decision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_assumption_id`) REFERENCES `assumption`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision_parent_decision` (
	`decision_id` integer NOT NULL,
	`parent_decision_id` integer NOT NULL,
	PRIMARY KEY(`decision_id`, `parent_decision_id`),
	FOREIGN KEY (`decision_id`) REFERENCES `decision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_decision_id`) REFERENCES `decision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`turn_id` integer NOT NULL,
	`position` integer NOT NULL,
	`content` text NOT NULL,
	`is_recommended` integer DEFAULT 0 NOT NULL,
	`is_selected` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_turn_position_unique` ON `option` (`turn_id`,`position`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active_turn_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`content` text NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirement_decision` (
	`requirement_id` integer NOT NULL,
	`decision_id` integer NOT NULL,
	PRIMARY KEY(`requirement_id`, `decision_id`),
	FOREIGN KEY (`requirement_id`) REFERENCES `requirement`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decision_id`) REFERENCES `decision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`parent_turn_id` integer,
	`phase` text NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`why` text,
	`impact` text,
	`answer` text,
	`is_resolution` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn_assumption` (
	`turn_id` integer NOT NULL,
	`assumption_id` integer NOT NULL,
	PRIMARY KEY(`turn_id`, `assumption_id`),
	FOREIGN KEY (`turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assumption_id`) REFERENCES `assumption`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn_decision` (
	`turn_id` integer NOT NULL,
	`decision_id` integer NOT NULL,
	PRIMARY KEY(`turn_id`, `decision_id`),
	FOREIGN KEY (`turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decision_id`) REFERENCES `decision`(`id`) ON UPDATE no action ON DELETE no action
);
