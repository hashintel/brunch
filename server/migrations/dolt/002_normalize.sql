-- 002_normalize.sql: Break clarifying_state JSON blob into proper tables
-- for reliable Dolt diffs, AS OF queries, and checkout.

CREATE TABLE IF NOT EXISTS `assumption` (
    `pk`          INT AUTO_INCREMENT PRIMARY KEY,
    `uuid`        VARCHAR(36) NOT NULL,
    `project_id`  INT NOT NULL,
    `text`        TEXT,
    `rationale`   TEXT,
    `confidence`  VARCHAR(10),
    `impact`      VARCHAR(10),
    `status`      VARCHAR(20) NOT NULL DEFAULT 'pending',
    `edited_text` TEXT,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `created_at`  DATETIME NOT NULL DEFAULT NOW(),
    `updated_at`  DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (`project_id`) REFERENCES `project`(`pk`) ON DELETE CASCADE
);
CREATE INDEX `IDX_assumption_project_id` ON `assumption`(`project_id`);

CREATE TABLE IF NOT EXISTS `goal_iteration` (
    `pk`          INT AUTO_INCREMENT PRIMARY KEY,
    `uuid`        VARCHAR(36) NOT NULL,
    `project_id`  INT NOT NULL,
    `goal_text`   TEXT,
    `questions`   JSON,
    `answers`     JSON,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `created_at`  DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (`project_id`) REFERENCES `project`(`pk`) ON DELETE CASCADE
);
CREATE INDEX `IDX_goal_iteration_project_id` ON `goal_iteration`(`project_id`);

ALTER TABLE `project`
    ADD COLUMN `clarifying_done`     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN `assumptions_done`    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN `questions_exhausted` BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN `current_questions`   JSON,
    ADD COLUMN `current_answers`     JSON;

ALTER TABLE `entry` ADD COLUMN `uuid` VARCHAR(36);
CREATE INDEX `IDX_entry_uuid` ON `entry`(`uuid`);
