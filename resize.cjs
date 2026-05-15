const fs = require('fs');
const path = require('path');

const replacements = [
  { p: /rounded-\[3\.5rem\]/g, r: 'rounded-3xl' },
  { p: /rounded-\[3rem\]/g, r: 'rounded-3xl' },
  { p: /rounded-\[2\.5rem\]/g, r: 'rounded-2xl' },
  { p: /rounded-\[2rem\]/g, r: 'rounded-2xl' },
  { p: /p-12/g, r: 'p-6' },
  { p: /p-10/g, r: 'p-6' },
  { p: /sm:p-12/g, r: 'sm:p-8' },
  { p: /sm:p-10/g, r: 'sm:p-6' },
  { p: /md:p-12/g, r: 'md:p-8' },
  { p: /md:p-10/g, r: 'md:p-6' },
  { p: /lg:p-16/g, r: 'lg:p-8' },
  { p: /lg:p-20/g, r: 'lg:p-10' },
  { p: /px-12/g, r: 'px-6' },
  { p: /px-10/g, r: 'px-5' },
  { p: /sm:px-12/g, r: 'sm:px-8' },
  { p: /text-5xl/g, r: 'text-3xl' },
  { p: /text-4xl/g, r: 'text-2xl' }
];

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getFiles(path.join(dir, file), filesList);
    } else if (file.match(/\.(tsx|ts|jsx|js|css)$/)) {
      filesList.push(path.join(dir, file));
    }
  }
  return filesList;
}

const files = getFiles('src');
let changedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  replacements.forEach(({p, r}) => {
    content = content.replace(p, r);
  });
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
  }
});
console.log('Done replacing padding and borders. Changed ' + changedFiles + ' files.');
