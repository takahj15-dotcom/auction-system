// One-time script to set initial password "0000" for all members without a password
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Hash the default password "0000"
  const hashedPassword = await bcrypt.hash("0000", 10);
  
  // Update all members that don't have a password set
  const [result] = await connection.execute(
    "UPDATE members SET password = ?, requirePasswordChange = true WHERE password IS NULL",
    [hashedPassword]
  );
  
  console.log(`Updated ${result.affectedRows} members with initial password "0000"`);
  
  // Also update members who already have a password to "0000" (reset all)
  const [result2] = await connection.execute(
    "UPDATE members SET password = ?, requirePasswordChange = true WHERE password IS NOT NULL",
    [hashedPassword]
  );
  
  console.log(`Reset ${result2.affectedRows} existing member passwords to "0000"`);
  
  await connection.end();
  console.log("Done!");
}

main().catch(console.error);
