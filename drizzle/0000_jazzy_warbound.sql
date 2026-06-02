CREATE TABLE `change_log` (
	`lsn` integer PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`source_id` integer NOT NULL,
	`target_id` integer NOT NULL,
	`stance` text,
	`basis` text DEFAULT 'explicit' NOT NULL,
	`rationale` text,
	`created_at_lsn` integer NOT NULL,
	`updated_at_lsn` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `graph_clock` (
	`id` integer PRIMARY KEY NOT NULL,
	`lsn` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `graph_clock` (`id`, `lsn`) VALUES (1, 0);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plane` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`basis` text DEFAULT 'explicit' NOT NULL,
	`source` text,
	`detail` text,
	`created_at_lsn` integer NOT NULL,
	`updated_at_lsn` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reconciliation_need` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_kind` text NOT NULL,
	`target_edge_id` integer,
	`target_a_id` integer,
	`target_b_id` integer,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reason` text,
	`created_at_lsn` integer NOT NULL,
	`resolved_at_lsn` integer,
	FOREIGN KEY (`target_edge_id`) REFERENCES `edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_a_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_b_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `specs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`readiness_grade` text DEFAULT 'grounding_onboarding' NOT NULL
);
