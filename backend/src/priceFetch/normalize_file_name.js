const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');


/*
This command normalizes the file name to a specific format, in addition to checking for
any malformations in the XML files - in which case it deletes the files.
*/

const DOWNLOAD_ROOT = path.join(__dirname, 'Downloads');
const VALID_FILE_PATTERN = /^PriceFull(\d+)-(\d+)-/i;
const CONTAINS_VALID_FILE_PATTERN = /PriceFull(\d+)-(\d+)-/i;

if (!fs.existsSync(DOWNLOAD_ROOT)) {
    console.warn(`⚠️ Downloads directory not found at ${DOWNLOAD_ROOT}, no files to normalize.`);
    process.exit(0);
  }

  async function normalizeName(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndExtract(fullPath);

      } else if (entry.isFile() && entry.name.test(VALID_FILE_PATTERN)) {
        continue;
      } else if (entry.isFile() && entry.name.test(CONTAINS_VALID_FILE_PATTERN)){/*
        const xmlName = entry.name.replace(/\.gz$/i, '.xml');
        const xmlPath = path.join(dir, xmlName);
        console.log(`🔓 Extracting ${path.relative(DOWNLOAD_ROOT, fullPath)} → ${xmlName}`);
        try {
          await pipeline(
            fs.createReadStream(fullPath),
            zlib.createGunzip(),
            fs.createWriteStream(xmlPath)
          );
          await fsp.unlink(fullPath);
        } catch (err) {
          console.error(`⚠️ Failed to extract ${entry.name}: ${err.message}`);
        }
    */}
    }
  }


(async () => {
    try {
      console.log(`\n🗂️ Flatten & extract all .gz in ${DOWNLOAD_ROOT}`);
      await walkAndExtract(DOWNLOAD_ROOT);
      console.log(`\n✅ Done — all .gz replaced by .xml in place.`);
    } catch (err) {
      console.error('💥 Fatal error:', err);
      process.exit(1);
    }
  })();