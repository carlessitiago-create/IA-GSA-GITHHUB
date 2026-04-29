const yauzl = require('yauzl');
const fs = require('fs');
const path = require('path');

yauzl.open('IA-GSA-GITHHUB-main.zip', {lazyEntries: true}, (err, zipfile) => {
  if (err) throw err;
  zipfile.readEntry();
  zipfile.on('entry', (entry) => {
    if (/\/$/.test(entry.fileName)) {
      fs.mkdirSync(entry.fileName, {recursive: true});
      zipfile.readEntry();
    } else {
      // Ensure directory exists
      const dir = path.dirname(entry.fileName);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) throw err;
        const writeStream = fs.createWriteStream(entry.fileName);
        readStream.pipe(writeStream);
        writeStream.on('finish', () => zipfile.readEntry());
      });
    }
  });
});
