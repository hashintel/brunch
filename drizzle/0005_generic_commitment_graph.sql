CREATE TABLE `knowledge_edge` (
	`from_item_id` integer NOT NULL,
	`to_item_id` integer NOT NULL,
	`relation` text NOT NULL,
	PRIMARY KEY(`from_item_id`, `to_item_id`, `relation`),
	FOREIGN KEY (`from_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_item_id`) REFERENCES `knowledge_item`(`id`) ON UPDATE no action ON DELETE no action
);
