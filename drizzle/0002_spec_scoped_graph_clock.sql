CREATE TABLE `graph_clock_new` (
	`spec_id` integer PRIMARY KEY NOT NULL,
	`lsn` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `graph_clock_new` (`spec_id`, `lsn`)
SELECT
	`specs`.`id`,
	COALESCE(`max_lsn_by_spec`.`lsn`, 0)
FROM `specs`
LEFT JOIN (
	SELECT `spec_id`, max(`lsn`) AS `lsn`
	FROM (
		SELECT `spec_id`, `created_at_lsn` AS `lsn` FROM `nodes`
		UNION ALL
		SELECT `spec_id`, `updated_at_lsn` AS `lsn` FROM `nodes`
		UNION ALL
		SELECT `spec_id`, `created_at_lsn` AS `lsn` FROM `edges`
		UNION ALL
		SELECT `spec_id`, `updated_at_lsn` AS `lsn` FROM `edges`
		UNION ALL
		SELECT `spec_id`, `created_at_lsn` AS `lsn` FROM `reconciliation_need`
		UNION ALL
		SELECT `spec_id`, `resolved_at_lsn` AS `lsn` FROM `reconciliation_need` WHERE `resolved_at_lsn` IS NOT NULL
	)
	GROUP BY `spec_id`
) `max_lsn_by_spec` ON `max_lsn_by_spec`.`spec_id` = `specs`.`id`
WHERE `max_lsn_by_spec`.`lsn` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `graph_clock`;
--> statement-breakpoint
ALTER TABLE `graph_clock_new` RENAME TO `graph_clock`;
--> statement-breakpoint
CREATE TABLE `change_log_new` (
	`spec_id` integer NOT NULL,
	`lsn` integer NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`spec_id`, `lsn`),
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `change_log_new` (`spec_id`, `lsn`, `operation`, `payload`, `created_at`)
SELECT
	CAST(json_extract(`payload`, '$.specId') AS integer) AS `spec_id`,
	`lsn`,
	`operation`,
	`payload`,
	`created_at`
FROM `change_log`
WHERE json_extract(`payload`, '$.specId') IS NOT NULL;
--> statement-breakpoint
DROP TABLE `change_log`;
--> statement-breakpoint
ALTER TABLE `change_log_new` RENAME TO `change_log`;