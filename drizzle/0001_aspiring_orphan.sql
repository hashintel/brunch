CREATE TABLE `node_kind_counters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` integer NOT NULL,
	`plane` text NOT NULL,
	`kind` text NOT NULL,
	`next_ordinal` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `node_kind_counters_spec_plane_kind_unique` ON `node_kind_counters` (`spec_id`,`plane`,`kind`);--> statement-breakpoint
ALTER TABLE `nodes` ADD `kind_ordinal` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_spec_plane_kind_ordinal_unique` ON `nodes` (`spec_id`,`plane`,`kind`,`kind_ordinal`);