import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { members } from './drizzle/schema.ts';
import { asc } from 'drizzle-orm';
import fs from 'fs';

const pool = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(pool);

async function main() {
  // Get all members from DB
  const dbMembers = await db.select().from(members).orderBy(asc(members.memberNumber));
  
  console.log(`Total members in DB: ${dbMembers.length}`);
  
  // Save to JSON for comparison
  const output = dbMembers.map(m => ({
    id: m.id,
    memberNumber: m.memberNumber,
    displayName: m.displayName,
    tradeName: m.tradeName,
    representative: m.representative,
    invoiceNumber: m.invoiceNumber,
    antiquePermitNumber: m.antiquePermitNumber,
    sellCommissionRate: m.sellCommissionRate,
    buyCommissionRate: m.buyCommissionRate,
    phone: m.phone,
    mobile: m.mobile,
    email: m.email,
    postalCode: m.postalCode,
    prefecture: m.prefecture,
    address: m.address,
    participationFee: m.participationFee,
    isTaxable: m.isTaxable,
    isActive: m.isActive,
  }));
  
  fs.writeFileSync('/home/ubuntu/db_members.json', JSON.stringify(output, null, 2));
  console.log('Saved DB members to /home/ubuntu/db_members.json');
  
  // Print first few
  for (const m of output.slice(0, 3)) {
    console.log(`  #${m.memberNumber}: ${m.displayName} (sell=${m.sellCommissionRate}, buy=${m.buyCommissionRate})`);
    console.log(`    tradeName=${m.tradeName}, rep=${m.representative}, invoice=${m.invoiceNumber}`);
    console.log(`    phone=${m.phone}, email=${m.email}, address=${m.address}`);
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
