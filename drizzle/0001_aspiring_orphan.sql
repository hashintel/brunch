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
UPDATE `nodes` SET `basis` = 'explicit' WHERE `basis` = 'accepted_review_set';--> statement-breakpoint
UPDATE `edges` SET `basis` = 'explicit' WHERE `basis` = 'accepted_review_set';--> statement-breakpoint
ALTER TABLE `nodes` ADD `kind_ordinal` integer;--> statement-breakpoint
UPDATE `nodes`
SET `kind_ordinal` = (
	SELECT count(*)
	FROM `nodes` `prior_nodes`
	WHERE `prior_nodes`.`spec_id` = `nodes`.`spec_id`
		AND `prior_nodes`.`plane` = `nodes`.`plane`
		AND `prior_nodes`.`kind` = `nodes`.`kind`
		AND `prior_nodes`.`id` <= `nodes`.`id`
);--> statement-breakpoint
INSERT INTO `node_kind_counters` (`spec_id`, `plane`, `kind`, `next_ordinal`)
SELECT `spec_id`, `plane`, `kind`, max(`kind_ordinal`) + 1
FROM `nodes`
GROUP BY `spec_id`, `plane`, `kind`;--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_spec_plane_kind_ordinal_unique` ON `nodes` (`spec_id`,`plane`,`kind`,`kind_ordinal`);