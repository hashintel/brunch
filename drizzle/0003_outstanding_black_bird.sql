CREATE TABLE `elicitation_backlog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` integer NOT NULL,
	`kind` text NOT NULL,
	`question` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`basis` text DEFAULT 'explicit' NOT NULL,
	`readiness_band` text NOT NULL,
	`plane_affinity` text,
	`lens_affinity` text,
	`arose_from_entry_id` integer,
	`resolved_by_node_id` integer,
	`rationale` text,
	`created_at_lsn` integer NOT NULL,
	`closed_at_lsn` integer,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`arose_from_entry_id`) REFERENCES `elicitation_backlog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
