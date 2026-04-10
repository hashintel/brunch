CREATE TABLE `phase_outcome` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`phase` text NOT NULL,
	`proposal_turn_id` integer NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`summary` text NOT NULL,
	`confirmation_turn_id` integer,
	`confirmed_at` text,
	`superseded_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmation_turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action
);
