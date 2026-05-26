import fs from 'fs';
import path from 'path';

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('motion/react')) {
        content = content.replace(/motion\/react/g, 'framer-motion');
        fs.writeFileSync(fullPath, content);
        console.log(`Replaced in ${fullPath}`);
      }
    }
  }
}

replaceInDir('./src');
