CREATE TABLE `elicitation_gaps_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` integer NOT NULL,
	`refers_to` text NOT NULL,
	`question` text NOT NULL,
	`rationale` text NOT NULL,
	`disposition` text DEFAULT 'open' NOT NULL,
	`basis` text DEFAULT 'explicit' NOT NULL,
	`readiness_band` text NOT NULL,
	`predicate_kind` text NOT NULL,
	`predicate` text NOT NULL,
	`importance` integer DEFAULT 1 NOT NULL,
	`plane_affinity` text,
	`lens_affinity` text,
	`arose_from_gap_id` integer,
	`resolved_by_node_id` integer,
	`created_at_lsn` integer NOT NULL,
	`disposition_set_at_lsn` integer,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`arose_from_gap_id`) REFERENCES `elicitation_gaps_new`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `elicitation_gaps_new` (
	`id`,
	`spec_id`,
	`refers_to`,
	`question`,
	`rationale`,
	`disposition`,
	`basis`,
	`readiness_band`,
	`predicate_kind`,
	`predicate`,
	`importance`,
	`plane_affinity`,
	`lens_affinity`,
	`arose_from_gap_id`,
	`resolved_by_node_id`,
	`created_at_lsn`,
	`disposition_set_at_lsn`
)
SELECT
	`id`,
	`spec_id`,
	CASE
		WHEN `name` = 'domain' THEN 'context'
		WHEN `name` = 'protagonist' THEN 'thesis'
		WHEN `name` = 'pain_pull' THEN 'thesis'
		WHEN `name` = 'constraint' THEN 'constraint'
		WHEN `name` = 'value' THEN 'goal'
		WHEN `name` = 'context_of_use' THEN 'context'
		WHEN `name` = 'success_sketch' THEN 'criterion'
		WHEN `name` = 'solution_boundary' THEN 'constraint'
		ELSE COALESCE(json_extract(`predicate`, '$.nodeKind'), json_extract(`predicate`, '$.subjectKind'), 'context')
	END,
	CASE
		WHEN `name` = 'domain' THEN 'What kind of thing is this, and what domain or environment does it live in?'
		WHEN `name` = 'protagonist' THEN 'Who is this for?'
		WHEN `name` = 'pain_pull' THEN 'What pull or pain makes this worth doing?'
		WHEN `name` = 'constraint' THEN 'What binding constraints, non-goals, or boundaries already shape the work?'
		WHEN `name` = 'value' THEN 'What outcome or value should this create?'
		WHEN `name` = 'context_of_use' THEN 'When, where, or under what conditions will it be used?'
		WHEN `name` = 'success_sketch' THEN 'How will we recognize success or good enough?'
		WHEN `name` = 'solution_boundary' THEN 'What is explicitly out of scope or off the table?'
		ELSE CASE WHEN trim(`name`) = '' THEN 'What needs to be clarified here?' ELSE trim(`name`) END
	END,
	`rationale`,
	`disposition`,
	`basis`,
	`readiness_band`,
	`predicate_kind`,
	`predicate`,
	`importance`,
	`plane_affinity`,
	`lens_affinity`,
	`arose_from_gap_id`,
	`resolved_by_node_id`,
	`created_at_lsn`,
	`disposition_set_at_lsn`
FROM `elicitation_gaps`;
--> statement-breakpoint
DROP TABLE `elicitation_gaps`;
--> statement-breakpoint
ALTER TABLE `elicitation_gaps_new` RENAME TO `elicitation_gaps`;
