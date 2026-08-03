import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*"?([^"\r\n]+)"?/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const API_KEY = env.API_KEY || '244bd61f-32b0-11ef-94f2-cec13431d72d';
const authHeader = 'Basic ' + Buffer.from(API_KEY + ':').toString('base64');

const models = [
  { key: 'MODEL_PIB', id: env.MODEL_PIB },
  { key: 'MODEL_PIB_LANJUTAN', id: env.MODEL_PIB_LANJUTAN },
  { key: 'MODEL_INVOICE', id: env.MODEL_INVOICE },
  { key: 'MODEL_BL', id: env.MODEL_BL },
  { key: 'MODEL_MASTER_BL', id: env.MODEL_MASTER_BL },
  { key: 'MODEL_PACKING_LIST', id: env.MODEL_PACKING_LIST },
  { key: 'MODEL_RECAP_DOCUMENT', id: env.MODEL_RECAP_DOCUMENT },
];

console.log('--- TESTING NANONETS MODELS 1 BY 1 ---\n');

async function testModel(model) {
  if (!model.id) {
    console.log(`❌ [${model.key}]: No Model ID configured`);
    return;
  }

  try {
    const url = `https://app.nanonets.com/api/v2/Product/Model/${model.id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [${model.key}] (${model.id}):`);
      console.log(`   Model Name: ${data.model_type || data.name || 'OK'}`);
      console.log(`   Status: Connected Successfully\n`);
    } else {
      const errText = await response.text();
      console.log(`⚠️ [${model.key}] (${model.id}): Status ${response.status}`);
      console.log(`   Message: ${errText.substring(0, 150)}\n`);
    }
  } catch (err) {
    console.log(`❌ [${model.key}] (${model.id}): Connection Error - ${err.message}\n`);
  }
}

async function run() {
  for (const m of models) {
    await testModel(m);
  }
}

run();
