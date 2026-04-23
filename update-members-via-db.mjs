// Use drizzle directly to update members
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const updates = [
  { memberNumber: 6, phone: '070-8983-5838' },
  { memberNumber: 17, phone: '090-3259-6610' },
  { memberNumber: 25, phone: '080-6910-0540' },
  { memberNumber: 31, phone: '090-7679-2257' },
  { memberNumber: 40, phone: '090-3565-0648' },
  { memberNumber: 63, phone: '090-4003-3661' },
  { memberNumber: 67, phone: '080-3652-4492' },
  { memberNumber: 70, phone: '080-2239-0305' },
  { memberNumber: 129, phone: '080-4399-4109' },
  { memberNumber: 134, phone: '080-3677-9229' },
  { memberNumber: 146, phone: '080-5611-9169' },
  { memberNumber: 147, invoiceNumber: 'T6-1800-0114-6505' },
  { memberNumber: 166, phone: '080-6947-5021' },
  { memberNumber: 167, phone: '090-1745-4366' },
  { memberNumber: 221, phone: '080-6929-0467' },
  { memberNumber: 271, phone: '080-6947-5021' },
  { memberNumber: 276, phone: '090-4112-7854' },
  { memberNumber: 289, phone: '090-5876-7607' },
  { memberNumber: 297, phone: '080-5322-0954' },
  { memberNumber: 304, phone: '090-4199-6947' },
  { memberNumber: 305, phone: '090-2267-1112' },
  { memberNumber: 323, phone: '090-3389-4950' },
  { memberNumber: 326, phone: '090-5635-9464' },
  { memberNumber: 327, phone: '090-4150-8487' },
  { memberNumber: 331, phone: '070-4387-1490' },
  { memberNumber: 341, phone: '090-9923-8191' },
  { memberNumber: 343, phone: '090-4198-4881' },
  { memberNumber: 350, phone: '090-3154-3571' },
  { memberNumber: 352, phone: '080-3652-4431' },
  { memberNumber: 356, phone: '090-4568-6881' },
  { memberNumber: 373, phone: '080-4841-3462' },
  { memberNumber: 378, phone: '070-1613-3091' },
  { memberNumber: 514, phone: '090-5622-8947' },
  { memberNumber: 516, phone: '080-6929-0467' },
  { memberNumber: 519, phone: '090-9006-3671' },
  { memberNumber: 520, phone: '070-5593-1599' },
  { memberNumber: 522, phone: '080-3653-5898' },
  { memberNumber: 531, phone: '080-3288-8474' },
  { memberNumber: 532, phone: '090-5607-7885' },
  { memberNumber: 538, phone: '080-1047-8358' },
  { memberNumber: 551, phone: '090-6656-3264' },
  { memberNumber: 559, phone: '070-5330-8555' },
  { memberNumber: 567, phone: '080-5150-0007' },
  { memberNumber: 569, phone: '080-7000-0860' },
  { memberNumber: 573, phone: '090-6465-6446' },
  { memberNumber: 575, phone: '070-9205-1863' },
  { memberNumber: 577, phone: '090-9717-4853' },
  { memberNumber: 580, phone: '080-9281-9126' },
  { memberNumber: 583, phone: '080-4531-4514' },
  { memberNumber: 585, phone: '090-7618-1107' },
  { memberNumber: 588, phone: '090-9189-5199' },
  { memberNumber: 591, phone: '080-6968-1720' },
  { memberNumber: 598, phone: '070-8409-5885' },
];

async function main() {
  const pool = mysql.createPool(DATABASE_URL);
  
  console.log(`Total updates: ${updates.length}`);
  let success = 0;
  let failed = 0;
  
  for (const u of updates) {
    try {
      if (u.phone) {
        const [result] = await pool.execute(
          'UPDATE members SET phone = ?, updatedAt = NOW() WHERE memberNumber = ?',
          [u.phone, u.memberNumber]
        );
        if (result.affectedRows > 0) {
          success++;
          console.log(`  ✓ #${u.memberNumber}: phone = ${u.phone}`);
        } else {
          console.warn(`  ✗ #${u.memberNumber}: no rows affected`);
          failed++;
        }
      }
      if (u.invoiceNumber) {
        const [result] = await pool.execute(
          'UPDATE members SET invoiceNumber = ?, updatedAt = NOW() WHERE memberNumber = ?',
          [u.invoiceNumber, u.memberNumber]
        );
        if (result.affectedRows > 0) {
          success++;
          console.log(`  ✓ #${u.memberNumber}: invoiceNumber = ${u.invoiceNumber}`);
        } else {
          console.warn(`  ✗ #${u.memberNumber}: no rows affected`);
          failed++;
        }
      }
    } catch (err) {
      console.error(`  ✗ #${u.memberNumber}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${success} updated, ${failed} failed`);
  
  // Verify
  const [rows] = await pool.execute(
    'SELECT memberNumber, displayName, phone, invoiceNumber FROM members WHERE memberNumber IN (6, 147, 598) ORDER BY memberNumber'
  );
  console.log('\nVerification:');
  for (const row of rows) {
    console.log(`  #${row.memberNumber} ${row.displayName}: phone=${row.phone}, invoice=${row.invoiceNumber}`);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
