PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `turn` ADD `chat_id` integer REFERENCES `chat`(`id`);--> statement-breakpoint
UPDATE `turn` SET `chat_id` = (
	SELECT `id` FROM `chat`
	WHERE `chat`.`specification_id` = `turn`.`specification_id`
	  AND `chat`.`kind` = 'interview'
);--> statement-breakpoint
PRAGMA foreign_keys=ON;
