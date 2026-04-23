CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`action` text NOT NULL,
	`tableName` text NOT NULL,
	`recordId` integer,
	`oldValue` text,
	`newValue` text,
	`ipAddress` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`memberId` integer NOT NULL,
	`isPresent` integer DEFAULT 0 NOT NULL,
	`isFeeExempt` integer DEFAULT 0 NOT NULL,
	`companionCount` integer DEFAULT 0 NOT NULL,
	`feeCollected` integer DEFAULT 0 NOT NULL,
	`checkedInAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventDate` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'open' NOT NULL,
	`sellCommissionRate` text DEFAULT '10.00' NOT NULL,
	`buyCommissionRate` text DEFAULT '5.00' NOT NULL,
	`absentSellCommissionRate` text DEFAULT '15.00' NOT NULL,
	`absentBuyCommissionRate` text DEFAULT '5.00' NOT NULL,
	`participationFee` integer DEFAULT 2000 NOT NULL,
	`companionFee` integer DEFAULT 1000 NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`memberId` integer NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`type` text DEFAULT 'info' NOT NULL,
	`linkUrl` text,
	`isRead` integer DEFAULT 0 NOT NULL,
	`readAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`memberNumber` integer NOT NULL,
	`displayName` text NOT NULL,
	`tradeName` text,
	`representative` text,
	`invoiceNumber` text,
	`antiquePermitNumber` text,
	`sellCommissionRate` text DEFAULT '10.00' NOT NULL,
	`buyCommissionRate` text DEFAULT '5.00' NOT NULL,
	`useCustomCommission` integer DEFAULT 0 NOT NULL,
	`phone` text,
	`mobile` text,
	`email` text,
	`postalCode` text,
	`prefecture` text,
	`address` text,
	`participationFee` integer DEFAULT 0 NOT NULL,
	`isTaxable` integer DEFAULT 1 NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`password` text,
	`requirePasswordChange` integer DEFAULT 1 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_memberNumber_unique` ON `members` (`memberNumber`);--> statement-breakpoint
CREATE TABLE `register_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`settlementId` integer NOT NULL,
	`memberId` integer NOT NULL,
	`memberNumber` integer NOT NULL,
	`memberName` text NOT NULL,
	`depositAmount` integer DEFAULT 0 NOT NULL,
	`paymentAmount` integer DEFAULT 0 NOT NULL,
	`receivedAmount` integer DEFAULT 0 NOT NULL,
	`changeAmount` integer DEFAULT 0 NOT NULL,
	`settlementAmount` integer DEFAULT 0 NOT NULL,
	`signatureUrl` text,
	`processedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`memberId` integer NOT NULL,
	`salesTotal` integer DEFAULT 0 NOT NULL,
	`salesCommission` integer DEFAULT 0 NOT NULL,
	`purchaseTotal` integer DEFAULT 0 NOT NULL,
	`purchaseCommission` integer DEFAULT 0 NOT NULL,
	`participationFee` integer DEFAULT 0 NOT NULL,
	`companionCount` integer DEFAULT 0 NOT NULL,
	`companionFee` integer DEFAULT 0 NOT NULL,
	`taxAmount` integer DEFAULT 0 NOT NULL,
	`salesReturnTotal` integer DEFAULT 0 NOT NULL,
	`purchaseReturnTotal` integer DEFAULT 0 NOT NULL,
	`settlementAmount` integer DEFAULT 0 NOT NULL,
	`isSettled` integer DEFAULT 0 NOT NULL,
	`settledAt` integer,
	`settlementType` text DEFAULT 'final' NOT NULL,
	`pdfUrl` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`settingKey` text NOT NULL,
	`settingValue` text,
	`description` text,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_settingKey_unique` ON `system_settings` (`settingKey`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`rowNumber` integer,
	`sellerMemberId` integer NOT NULL,
	`buyerMemberId` integer NOT NULL,
	`itemName` text NOT NULL,
	`unitPrice` integer DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`totalPrice` integer DEFAULT 0 NOT NULL,
	`transactionType` text DEFAULT 'normal' NOT NULL,
	`notes` text,
	`version` integer DEFAULT 1 NOT NULL,
	`isDeleted` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);