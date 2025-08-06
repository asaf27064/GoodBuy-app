const path = require('path');
const { spawn } = require('child_process');
const SystemMeta = require('../models/SystemMeta');

module.exports = async function runPricePipeline() {
  await SystemMeta.findByIdAndUpdate(
    'price-refresh',
    { $set: { lastRunStart: new Date(), lastRunOk: false, running: true } },
    { upsert: true }
  );

  const proc = spawn('node', ['priceFetch/pipeline.js', 'update'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe', 
    detached: false
  });

  let pipelineOutput = '';
  proc.stdout?.on('data', (data) => {
    pipelineOutput += data.toString();
  });
  
  proc.stderr?.on('data', (data) => {
    console.error('Pipeline stderr:', data.toString());
  });

  // Handle completion asynchronously
  proc.on('exit', async (code) => {
    console.log(`Pipeline finished with exit code: ${code}`);
    if (pipelineOutput) {
      console.log('Pipeline output (last 500 chars):', pipelineOutput.slice(-500));
    }
    try {
      await SystemMeta.findByIdAndUpdate(
        'price-refresh',
        { $set: { lastRunEnd: new Date(), lastRunOk: code === 0, running: false } }
      );
    } catch (err) {
      console.error('Failed to update pipeline status:', err);
    }
  });

  proc.on('error', async (err) => {
    console.error('Pipeline error:', err);
    try {
      await SystemMeta.findByIdAndUpdate(
        'price-refresh',
        { $set: { lastRunEnd: new Date(), lastRunOk: false, running: false } }
      );
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr);
    }
  });

  // Return immediately - don't wait for pipeline completion
  return Promise.resolve();
};