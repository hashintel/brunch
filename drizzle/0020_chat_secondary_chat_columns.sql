ALTER TABLE `chat` ADD `parent_chat_id` integer REFERENCES `chat`(`id`);--> statement-breakpoint
ALTER TABLE `chat` ADD `invoked_in_turn_id` integer REFERENCES `turn`(`id`);--> statement-breakpoint
ALTER TABLE `chat` ADD `pinned_item_id` integer REFERENCES `knowledge_item`(`id`);--> statement-breakpoint
ALTER TABLE `chat` ADD `pinned_span_hint` text;--> statement-breakpoint
CREATE INDEX `chat_parent_chat_id_idx` ON `chat` (`parent_chat_id`);--> statement-breakpoint
CREATE INDEX `chat_invoked_in_turn_id_idx` ON `chat` (`invoked_in_turn_id`);
