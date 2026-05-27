const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env.local';
if (!fs.existsSync(envPath)) process.exit(0);

const envVars = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.rpc('execute_sql', { 
    sql_query: 'ALTER TABLE staff ADD COLUMN IF NOT EXISTS rest_days jsonb DEFAULT \'[]\'::jsonb;' 
  });
  console.log(error || 'Column exists or created.');
}
run();
