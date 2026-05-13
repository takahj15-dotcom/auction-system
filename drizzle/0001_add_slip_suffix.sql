-- 伝票分割（A/B/C）対応: transactions と settlements に枝番カラムを追加
ALTER TABLE `transactions` ADD COLUMN `sellerSuffix` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `buyerSuffix` text;
--> statement-breakpoint
ALTER TABLE `settlements` ADD COLUMN `suffix` text;
