ALTER TABLE `project` ADD `mode` text NOT NULL DEFAULT 'greenfield';
--> statement-breakpoint
ALTER TABLE `project` ADD `cwd` text;
