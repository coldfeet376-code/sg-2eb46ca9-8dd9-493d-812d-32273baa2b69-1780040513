const fs = require('fs');
const { execSync } = require('child_process');

// Read .env.local to get DB connection string
const envContent = fs.readFileSync('.env.local', 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);

if (!dbUrlMatch) {
  console.log("No DATABASE_URL found in .env.local");
  process.exit(1);
}

const dbUrl = dbUrlMatch[1];

// Create SQL file
const sql = `
CREATE TABLE IF NOT EXISTS two_factor_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'two_factor_codes' AND policyname = 'Allow public access to two_factor_codes'
  ) THEN
    CREATE POLICY "Allow public access to two_factor_codes" ON two_factor_codes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

fs.writeFileSync('2fa-migration.sql', sql);

try {
  // Execute using psql if available, or print instructions
  console.log("Migration script created: 2fa-migration.sql");
  console.log("To apply, run this SQL in your Supabase SQL editor.");
} catch (e) {
  console.error("Error:", e.message);
}