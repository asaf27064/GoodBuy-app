const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');


/*
This command normalizes the file name to a specific format. Specifically handles edgecase of hazihinam files.
*/

const DOWNLOAD_ROOT = path.join(__dirname, 'Downloads');

const MODE = process.argv[2] === 'update' ? 'update' : 'init';
const VALID_FILE_PATTERN = MODE === 'init'
? /^PriceFull(\d+)-(\d+)-(\d+)/i
: /^Prices?(\d+)-(\d+)-/i;

const CONTAINS_VALID_FILE_PATTERN = MODE === 'init'
? /PriceFull(\d+)-(\d+)-(\d+)/i
: /Prices?(\d+)-(\d+)-/i;;

if (!fs.existsSync(DOWNLOAD_ROOT)) {
    console.warn(`⚠️ Downloads directory not found at ${DOWNLOAD_ROOT}, no files to normalize.`);
    process.exit(0);
  }

  async function normalizeName(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await normalizeName(fullPath);

      } else if (entry.isFile() && VALID_FILE_PATTERN.test(entry.name)) {
        continue;
      } else if (entry.isFile() && CONTAINS_VALID_FILE_PATTERN.test(entry.name)){
        const newName = entry.name.replace("-000-", "-").slice(4);
        fs.rename(fullPath, path.join(dir, newName), (err) => {
          if (err) {
            console.error('Error renaming ' + entry.name + ":", err);
          }
        });
      }
    }
  }


(async () => {
    try {
      console.log(`\n🗂️ normalize all file containing (but not perfectly matching) a valid file name in ${DOWNLOAD_ROOT}`);
      await normalizeName(DOWNLOAD_ROOT);
      console.log(`\n✅ Done — file names normalized.`);
    } catch (err) {
      console.error('💥 Fatal error:', err);
      process.exit(1);
    }
  })();