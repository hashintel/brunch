-- Consolidated schema for Dolt (MySQL-compatible)
-- Derived from SQLite migrations 001-005

CREATE TABLE IF NOT EXISTS `project` (
    `pk`               INT AUTO_INCREMENT PRIMARY KEY,
    `name`             VARCHAR(255),
    `goal`             TEXT,
    `folder`           VARCHAR(255),
    `prompt`           TEXT,
    `model`            TEXT,
    `clarifying_state` TEXT,
    `created_at`       DATETIME NOT NULL DEFAULT NOW(),
    `updated_at`       DATETIME NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS `entry` (
    `pk`          INT AUTO_INCREMENT PRIMARY KEY,
    `title`       VARCHAR(255),
    `description` TEXT,
    `test`        TEXT,
    `stage`       ENUM('proposal', 'approved', 'completed'),
    `confidence`  DOUBLE,
    `project_id`  INT,
    `parent_id`   INT,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `created_at`  DATETIME NOT NULL DEFAULT NOW(),
    `updated_at`  DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (`project_id`) REFERENCES `project`(`pk`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_id`)  REFERENCES `entry`(`pk`) ON DELETE SET NULL
);

CREATE INDEX `IDX_entry_project_id` ON `entry`(`project_id`);
CREATE INDEX `IDX_entry_parent_id`  ON `entry`(`parent_id`);

CREATE TABLE IF NOT EXISTS `api_call` (
    `pk`            INT AUTO_INCREMENT PRIMARY KEY,
    `method`        VARCHAR(10) NOT NULL,
    `path`          TEXT NOT NULL,
    `status_code`   INT,
    `model`         TEXT,
    `session_id`    VARCHAR(255),
    `request_body`  LONGTEXT,
    `response_body` LONGTEXT,
    `duration_ms`   INT,
    `error`         TEXT,
    `created_at`    DATETIME NOT NULL DEFAULT NOW()
);

CREATE INDEX `IDX_api_call_path`       ON `api_call`(`path`(255));
CREATE INDEX `IDX_api_call_session_id` ON `api_call`(`session_id`);
CREATE INDEX `IDX_api_call_created_at` ON `api_call`(`created_at`);

CREATE TABLE IF NOT EXISTS `claude_call` (
    `pk`            INT AUTO_INCREMENT PRIMARY KEY,
    `model`         VARCHAR(255) NOT NULL,
    `caller`        VARCHAR(255) NOT NULL,
    `prompt`        LONGTEXT,
    `response`      LONGTEXT,
    `input_tokens`  INT,
    `output_tokens` INT,
    `turns`         INT,
    `duration_ms`   INT,
    `status`        VARCHAR(50) NOT NULL DEFAULT 'success',
    `error`         TEXT,
    `cwd`           TEXT,
    `project_id`    INT REFERENCES `project`(`pk`),
    `created_at`    DATETIME NOT NULL DEFAULT NOW()
);

CREATE INDEX `IDX_claude_call_model`      ON `claude_call`(`model`);
CREATE INDEX `IDX_claude_call_caller`     ON `claude_call`(`caller`);
CREATE INDEX `IDX_claude_call_created_at` ON `claude_call`(`created_at`);
CREATE INDEX `IDX_claude_call_project_id` ON `claude_call`(`project_id`);
