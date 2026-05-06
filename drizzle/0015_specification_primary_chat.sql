PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `specification` ADD `primary_chat_id` integer REFERENCES `chat`(`id`);--> statement-breakpoint
UPDATE `specification` SET `primary_chat_id` = (
	SELECT `id` FROM `chat`
	WHERE `chat`.`specification_id` = `specification`.`id`
	  AND `chat`.`kind` = 'interview'
);--> statement-breakpoint
PRAGMA foreign_keys=ON;
