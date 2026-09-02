const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '../../..');
const backendRoot = path.join(repoRoot, 'backend');

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
        path: path.relative(repoRoot, fullPath),
        size: stat.size
      });
    }
  });
  return results;
}

console.log('=== BACKEND MODULES ===');
try {
  const backendFiles = walk(path.join(backendRoot, 'src', 'modules'));
  backendFiles.forEach(f => console.log(`- ${f.path} (${f.size} bytes)`));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== FRONTEND MODULES ===');
try {
  const frontendFiles = walk(path.join(repoRoot, 'frontend', 'src', 'modules'));
  frontendFiles.forEach(f => console.log(`- ${f.path} (${f.size} bytes)`));
} catch (e) {
  console.error(e.message);
}
