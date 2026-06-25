const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push({
        path: path.relative(path.join(__dirname, '..'), fullPath),
        size: stat.size
      });
    }
  });
  return results;
}

console.log('=== BACKEND MODULES ===');
try {
  const backendFiles = walk(path.join(__dirname, 'src', 'modules'));
  backendFiles.forEach(f => console.log(`- ${f.path} (${f.size} bytes)`));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== FRONTEND MODULES ===');
try {
  const frontendFiles = walk(path.join(__dirname, '..', 'frontend', 'src', 'modules'));
  frontendFiles.forEach(f => console.log(`- ${f.path} (${f.size} bytes)`));
} catch (e) {
  console.error(e.message);
}
