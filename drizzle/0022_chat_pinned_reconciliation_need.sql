ALTER TABLE `chat` ADD `pinned_reconciliation_need_id` integer REFERENCES `reconciliation_need`(`id`);
