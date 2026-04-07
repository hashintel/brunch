CREATE TABLE `knowledge_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`kind` text NOT NULL,
	`subtype` text,
	`content` text NOT NULL,
	`rationale` text,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn_knowledge_item` (
	`turn_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`relation` text DEFAULT 'captured' NOT NULL,
	PRIMARY KEY(`turn_id`, `item_id`, `relation`),
	FOREIGN KEY (`turn_id`) REFERENCES `turn`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE no action
);
