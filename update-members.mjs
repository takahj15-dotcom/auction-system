import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
};

async function main() {
  const conn = await createConnection(config);
  
  const sqlContent = readFileSync('/home/ubuntu/member_updates_clean.sql', 'utf-8');
  const statements = sqlContent
    .split('\n')
    .filter(line => line.trim().startsWith('UPDATE'))
    .map(line => line.trim());
  
  console.log(`Total SQL statements to execute: ${statements.length}`);
  
  let success = 0;
  let failed = 0;
  
  for (const sql of statements) {
    try {
      const [result] = await conn.execute(sql);
      if (result.affectedRows > 0) {
        success++;
      } else {
        console.warn(`No rows affected: ${sql.substring(0, 80)}...`);
        failed++;
      }
    } catch (err) {
      console.error(`Error: ${err.message} - ${sql.substring(0, 80)}...`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${success} updated, ${failed} failed/no-match`);
  
  // Verify some updates
  const [rows] = await conn.execute(
    'SELECT memberNumber, displayName, phone, invoiceNumber FROM members WHERE memberNumber IN (6, 147, 598) ORDER BY memberNumber'
  );
  console.log('\nVerification:');
  for (const row of rows) {
    console.log(`  #${row.memberNumber} ${row.displayName}: phone=${row.phone}, invoice=${row.invoiceNumber}`);
  }
  
  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
