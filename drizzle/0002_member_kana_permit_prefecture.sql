-- 会員: フリガナ（屋号・氏名）と古物商の都道府県を追加
ALTER TABLE `members` ADD COLUMN `antiquePermitPrefecture` text;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `tradeNameKana` text;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `displayNameKana` text;
