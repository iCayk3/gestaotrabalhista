CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`op` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`version` integer NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`company`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_company_version` ON `history` (`company`,`version`);--> statement-breakpoint
CREATE TABLE `invites` (
	`hash` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`expires` text NOT NULL,
	`used` text,
	`recipient` text NOT NULL,
	FOREIGN KEY (`company`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invites_company` ON `invites` (`company`);--> statement-breakpoint
CREATE TABLE `members` (
	`company` text NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`company`, `user`),
	FOREIGN KEY (`company`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `members` (`user`);