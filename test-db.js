const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env file manually since dotenv is missing
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: config, error } = await supabase.from('task_config').select('*');
  console.log('Task Config:', config ? config.length + ' rows' : error);
  if (config) {
    const inbound = config.find(c => c.task === 'Inbound');
    console.log('Inbound requirements:', inbound);
  }
}
run();
