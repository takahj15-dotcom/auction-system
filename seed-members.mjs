import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// Read extracted data from PDF
const membersData = JSON.parse(readFileSync('/home/ubuntu/meibo_extracted.json', 'utf-8'));
console.log(`Loaded ${membersData.length} members from extracted PDF data`);

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const m of membersData) {
    try {
      // Check if member already exists
      const [existing] = await conn.execute(
        'SELECT id FROM members WHERE memberNumber = ?',
        [m.memberNumber]
      );
      
      if (existing.length > 0) {
        // Update existing member with new fields
        await conn.execute(
          `UPDATE members SET 
            displayName = ?, tradeName = ?, representative = ?,
            invoiceNumber = ?, antiquePermitNumber = ?,
            sellCommissionRate = ?, buyCommissionRate = ?,
            phone = ?, mobile = ?, email = ?,
            postalCode = ?, prefecture = ?, address = ?
          WHERE memberNumber = ?`,
          [
            m.displayName,
            m.tradeName || null,
            m.representative || null,
            m.invoiceNumber || null,
            m.antiqueNumber || null,
            m.sellRate.toFixed(2),
            m.buyRate.toFixed(2),
            m.phone || null,
            m.mobile || null,
            m.email || null,
            m.postalCode || null,
            m.prefecture || null,
            m.address || null,
            m.memberNumber,
          ]
        );
        updated++;
      } else {
        // Insert new member
        await conn.execute(
          `INSERT INTO members (memberNumber, displayName, tradeName, representative,
            invoiceNumber, antiquePermitNumber, sellCommissionRate, buyCommissionRate,
            phone, mobile, email, postalCode, prefecture, address,
            participationFee, isTaxable, isActive, requirePasswordChange)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, true, true, true)`,
          [
            m.memberNumber,
            m.displayName,
            m.tradeName || null,
            m.representative || null,
            m.invoiceNumber || null,
            m.antiqueNumber || null,
            m.sellRate.toFixed(2),
            m.buyRate.toFixed(2),
            m.phone || null,
            m.mobile || null,
            m.email || null,
            m.postalCode || null,
            m.prefecture || null,
            m.address || null,
          ]
        );
        inserted++;
      }
      
      if ((inserted + updated) % 50 === 0) {
        process.stdout.write(`\rProcessed ${inserted + updated + skipped}/${membersData.length}...`);
      }
    } catch (e) {
      console.error(`\n  ERROR #${m.memberNumber} ${m.displayName}: ${e.message}`);
      skipped++;
    }
  }
  
  console.log(`\n\n完了: ${inserted}件新規登録, ${updated}件更新, ${skipped}件エラー`);
  
  // Verify
  const [countResult] = await conn.execute('SELECT COUNT(*) as cnt FROM members WHERE isActive = 1');
  console.log(`DB内のアクティブ会員数: ${countResult[0].cnt}`);
  
  // Show some samples
  const [samples] = await conn.execute(
    'SELECT memberNumber, displayName, representative, phone, mobile, email, postalCode, address FROM members WHERE representative IS NOT NULL LIMIT 5'
  );
  console.log('\nサンプルデータ:');
  for (const s of samples) {
    console.log(`  #${s.memberNumber} ${s.displayName} | 代表:${s.representative} | TEL:${s.phone} | 携帯:${s.mobile} | 〒${s.postalCode} ${s.address}`);
  }
  
  await conn.end();
}

main().catch(console.error);
