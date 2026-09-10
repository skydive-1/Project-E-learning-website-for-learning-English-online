#!/usr/bin/env node

/**
 * i18n Extraction Script
 * Scans the codebase for hardcoded Vietnamese strings and generates translation keys
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const OUTPUT_FILE = path.join(__dirname, '../src/i18n/extracted-translations.js');

// Vietnamese text patterns to detect
const VIETNAMESE_PATTERNS = [
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/,
  /\b(?:và|hoặc|nhưng|còn|cũng|để|khi|nếu|thì|là|của|cho|với|tại|từ|trong|ngoài|trên|dưới|giữa|ngoài|về|theo|như|nhưng|cũng|đã|đang|sẽ|đã|được|bị|cần|phải|muốn|thích|biết|hiểu|biết|nhìn|nghe|nói|đọc|viết|học|dạy|chơi|nghỉ|ngủ|ăn|uống|đi|đến|về|ra|vào|ra|vào|mở|đóng|bật|tắt|bấm|ấn|kéo|thả|kéo|thả|chọn|bỏ|xóa|thêm|sửa|sao chép|dán|cắt|tìm|tìm kiếm|tìm thấy|tìm thấy|tìm thấy|tìm thấy|tìm thấy)\b/gi
];

// Regex to find Vietnamese strings in JSX/JS
const STRING_REGEX = /(['"`])([^'"`]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ][^'"`]*)\1/g;

// File extensions to scan
const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to exclude
const EXCLUDE_DIRS = ['node_modules', '.git', 'build', 'dist', '.cache', 'coverage'];

function isVietnamese(text) {
  return VIETNAMESE_PATTERNS.some(pattern => pattern.test(text));
}

function extractStringsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const strings = [];
  let match;

  while ((match = STRING_REGEX.exec(content)) !== null) {
    const quote = match[1];
    const str = match[2];
    
    // Skip if already a translation key
    if (str.startsWith('{{') || str.startsWith('t(') || str.includes('${')) {
      continue;
    }
    
    // Skip if it's a CSS class, ID, or technical string
    if (str.match(/^[a-zA-Z0-9_-]+$/)) continue;
    if (str.match(/^\.(jpg|png|svg|webp|gif|css|js|ts|tsx|jsx)$/i)) continue;
    if (str.match(/^(http|https|mailto|tel):/i)) continue;
    if (str.match(/^#[a-fA-F0-9]{3,8}$/)) continue;
    if (str.match(/^\d+$/)) continue;
    if (str.length < 2) continue;
    
    // Check if Vietnamese
    if (isVietnamese(str)) {
      // Get context (surrounding code)
      const start = Math.max(0, match.index - 100);
      const end = Math.min(content.length, match.index + match[0].length + 100);
      const context = content.substring(start, end).replace(/\n/g, ' ').trim();
      
      strings.push({
        key: str,
        file: filePath.replace(SRC_DIR + path.sep, ''),
        context
      });
    }
  }
  
  return strings;
}

function walkDir(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        walkDir(filePath, results);
      }
    } else if (FILE_EXTENSIONS.some(ext => file.endsWith(ext))) {
      const strings = extractStringsFromFile(filePath);
      results.push(...strings);
    }
  }
  
  return results;
}

// Main execution
console.log('Scanning for Vietnamese strings...');
const allStrings = walkDir(SRC_DIR);

// Deduplicate by key
const uniqueStrings = {};
allStrings.forEach(s => {
  if (!uniqueStrings[s.key]) {
    uniqueStrings[s.key] = s;
  } else {
    uniqueStrings[s.key].files = [...(uniqueStrings[s.key].files || [uniqueStrings[s.key].file]), s.file];
  }
});

const sortedKeys = Object.keys(uniqueStrings).sort((a, b) => a.localeCompare(b, 'vi'));

// Generate output
const output = `// Auto-generated i18n keys from codebase
// Generated on: ${new Date().toISOString()}
// Total keys: ${sortedKeys.length}
// 
// To use: import { t } from '../utils/i18n'; then t('Vietnamese text')

export const extractedTranslations = {
${sortedKeys.map(key => `  "${key.replace(/"/g, '\\"')}": "TODO_TRANSLATE_${key.replace(/"/g, '\\"')}",`).join('\n')}
};

export default extractedTranslations;
`;

fs.writeFileSync(OUTPUT_FILE, output);
console.log(`\nExtracted ${sortedKeys.length} unique Vietnamese strings`);
console.log(`Output written to: ${OUTPUT_FILE}`);
console.log('\nNext steps:');
console.log('1. Review the extracted keys in extracted-translations.js');
console.log('2. Add English translations for each key');
console.log('3. Merge with global-ui-translations.js');