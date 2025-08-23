CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`event` text NOT NULL,
	`message` text,
	`task_id` text,
	`user_id` text,
	`context` text,
	`error_code` text,
	`error_stack` text
);
--> statement-breakpoint
CREATE TABLE `detections` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`media_type` text NOT NULL,
	`page_url` text,
	`page_title` text,
	`thumbnail_url` text,
	`duration_sec` real,
	`file_size_bytes` integer,
	`variants` text,
	`headers` text,
	`skip_reason` text,
	`detected_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`last_seen_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`auto_delete` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text,
	`event` text NOT NULL,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`media_type` text NOT NULL,
	`filename` text,
	`save_dir` text,
	`file_size` integer,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` real DEFAULT 0,
	`percent` real DEFAULT 0,
	`speed_bps` integer,
	`downloaded_bytes` integer DEFAULT 0,
	`total_bytes` integer,
	`eta_ms` integer,
	`error` text,
	`error_code` text,
	`error_message` text,
	`error_details` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`headers` text,
	`variant` text,
	`quality_rule` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`paused_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`segment_index` integer NOT NULL,
	`url` text NOT NULL,
	`duration_sec` real,
	`size_bytes` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`temp_path` text,
	`error_message` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`downloaded_at` integer,
	PRIMARY KEY(`segment_index`, `task_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text,
	`description` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `statistics` (
	`date` text PRIMARY KEY NOT NULL,
	`total_downloads` integer DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`canceled_count` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`total_time_ms` integer DEFAULT 0 NOT NULL,
	`average_speed_bps` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statistics_domains` (
	`date` text NOT NULL,
	`domain` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`date`, `domain`),
	FOREIGN KEY (`date`) REFERENCES `statistics`(`date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `statistics_media_types` (
	`date` text NOT NULL,
	`media_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`date`, `media_type`),
	FOREIGN KEY (`date`) REFERENCES `statistics`(`date`) ON UPDATE no action ON DELETE cascade
);
