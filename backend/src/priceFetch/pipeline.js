const { spawn } = require('child_process');
const mongoose  = require('mongoose');
const path      = require('path');
const fs        = require('fs');
const Store     = require('../models/Store');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mode           = process.argv[2] === 'update' ? 'update' : 'init';
const MAX_RUNTIME_MS = 15 * 60 * 1000;
const baseDir        = __dirname;

const now = () => new Date().toISOString();
const hrToMs = hr => (hr[0] * 1000 + hr[1] / 1e6).toFixed(0);

function fireAndForget(label, script, args = []) {
  console.log(`\n[${now()}] 🔄 Background: ${label}`);

  const proc = spawn('node', [script, ...args], {
    cwd: baseDir,
    stdio: ['ignore', 'pipe', 'pipe'],  // Keep stdout/stderr for logging
    detached: true
  });

  proc.unref();

  proc.stdout?.on('data', (data) => {
    console.log(`${label}:`, data.toString().trim());
  });

  proc.stderr?.on('data', (data) => {
    console.error(`${label} error:`, data.toString().trim());
  });

  proc.on('exit', code =>
    console.log(`[${now()}] 🔄 ${label} finished with code ${code}`));

  proc.on('error', err =>
    console.error(`[${now()}] 🔄 ${label} error:`, err));
}

function runCommand(label, cmd, args = []) {
  const start = process.hrtime();
  console.log(`\n[${now()}] 🚀 Starting: ${label}`);
  return new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],  // Keep stdout/stderr pipes for logging
      cwd: baseDir 
    });

    // Capture output for better debugging
    let output = '';
    ps.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    ps.stderr?.on('data', (data) => {
      console.error(`${label} stderr:`, data.toString());
    });

    const timer = setTimeout(() => {
      console.error(`[${now()}] ⏱ Timeout: ${label} (${MAX_RUNTIME_MS / 60000} min)`);
      ps.kill('SIGKILL');
    }, MAX_RUNTIME_MS);

    ps.on('exit', code => {
      clearTimeout(timer);
      const duration = hrToMs(process.hrtime(start));
      if (code === 0) {
        console.log(`[${now()}] ✅ Done: ${label} in ${duration}ms`);
        if (output) console.log(`${label} output:`, output.slice(-200)); // Last 200 chars
        resolve();
      } else {
        console.error(`[${now()}] ❌ Failed: ${label} (exit ${code}) after ${duration}ms`);
        if (output) console.error(`${label} output:`, output.slice(-200));
        reject(new Error(`${label} failed (exit ${code})`));
      }
    });

    ps.on('error', err => {
      clearTimeout(timer);
      const duration = hrToMs(process.hrtime(start));
      console.error(`[${now()}] 💥 Error in: ${label} after ${duration}ms`);
      reject(err);
    });
  });
}

async function main() {
  const pipelineStart = process.hrtime();

  if (mode === 'init') {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      const count = await Store.countDocuments();
      await mongoose.disconnect();
      if (count > 0) {
        console.log(`[${now()}] ✅ DB already initialized – skipping INIT.`);
        //process.exit(0);
      }
    } catch (err) {
      console.error(`[${now()}] ❌ DB check failed:`, err);
      process.exit(1);
    }
  }

  console.log(`\n[${now()}] 🛠️ Starting pipeline in ${mode.toUpperCase()} mode`);

  if (mode === 'init') {
    await runCommand('STEP 1: parse_and_save_stores.js',    'node', ['parse_and_save_stores.js']);
    await runCommand('STEP 2: geocode_stores.js',          'node', ['geocode_stores.js']);
  }

  const fetchScripts = [
    //'fetch_hazihinam.js', // TODO: XML validation in general, normalizing file names for this specifically.
    'fetch_laibcatalog.js', // fixed by checking for "product" tag in addition to "item"
    // 'fetch_mega_carpur_bitan.js', // ERROR IN FILE FETCHING
    'fetch_pricefull_shufersal.js', // (1) Fixed by adding subchain Id extraction method.
    'fetch_publishedprices.js' //  changing fallback condition.
  ];
  console.log(`\n[${now()}] 📥 STEP 3: Running fetch scripts in parallel (${mode.toUpperCase()})`);
  await Promise.all(
    fetchScripts.map(script =>
      runCommand(`FETCH: ${script}`, 'node', [script, mode])
    )
  );

  await runCommand('STEP 4: decompress.js', 'node', ['decompress.js']);

  await runCommand(
    'STEP 5: parse_and_save_priceitems.js',
    'node',
    ['parse_and_save_priceitems.js', mode]
  );

  console.log(`\n[${now()}] 🗑 Deleting raw files in ${path.join(baseDir, 'Downloads')}`);
  await fs.promises.rm(path.join(baseDir, 'Downloads'), { recursive: true, force: true });
  console.log(`[${now()}] 🗑 Deleted Downloads folder`);

  await runCommand(
    'STEP 6: seedProductsFromPriceItems.js',
    'node',
    ['seedProductsFromPriceItems.js']
  );

  if (mode === 'init') {
    await runCommand(
      'STEP 6b: bootstrapSystemMeta.js',
      'node',
      ['bootstrapSystemMeta.js']
    );
  }

  fireAndForget(
    'STEP 7: sync_and_update_images_r2.js',
    'sync_and_update_images_r2.js',
    [mode]
  );

  const totalTime = hrToMs(process.hrtime(pipelineStart));
  console.log(`\n[${now()}] 🎉 Pipeline completed in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
}

main().catch(err => {
  console.error(`\n[${now()}] ❌ Pipeline failed:`, err);
  process.exit(1);
});