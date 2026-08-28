import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(frontendRoot, 'src');
const languageContextPath = path.join(sourceRoot, 'context', 'LanguageContext.jsx');
const aiQuotaTranslationsPath = path.join(sourceRoot, 'i18n', 'ai-quota-translations.js');
const globalTranslationsPath = path.join(sourceRoot, 'i18n', 'global-ui-translations.js');
const externalTranslationsPath = path.join(sourceRoot, 'i18n', 'external-ui-translations.js');
const vietnamesePattern = /[À-ỹĐđ]/;
const sourceFilePattern = /\.(?:js|jsx|ts|tsx)$/i;

const ignoredDirectories = new Set([
  path.join(sourceRoot, 'i18n'),
  path.join(sourceRoot, 'modules', 'courses', 'data'),
]);

const normalized = (value) => value.replace(/\s+/g, ' ').trim();
const isVietnamese = (value) => vietnamesePattern.test(value);
const placeholders = (value) => [...value.matchAll(/\{\{\d+\}\}/g)]
  .map(([placeholder]) => placeholder)
  .sort();

const parseSource = (filePath) => parse(fs.readFileSync(filePath, 'utf8'), {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
  errorRecovery: false,
});

const propertyName = (property) => {
  if (property.computed) return null;
  if (property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'StringLiteral') return property.key.value;
  return null;
};

const readStringObject = (node) => {
  if (!node || node.type !== 'ObjectExpression') return {};

  return node.properties.reduce((result, property) => {
    if (property.type !== 'ObjectProperty') return result;
    const key = propertyName(property);
    if (!key) return result;

    if (property.value.type === 'StringLiteral') {
      result[key] = property.value.value;
    } else if (property.value.type === 'ObjectExpression') {
      result[key] = readStringObject(property.value);
    }

    return result;
  }, {});
};

const findVariableObject = (ast, variableName) => {
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      if (declaration.id?.type === 'Identifier' && declaration.id.name === variableName) {
        return readStringObject(declaration.init);
      }
    }
  }
  return {};
};

const loadCoveredVietnamesePhrases = async () => {
  const languageAst = parseSource(languageContextPath);
  const keyedTranslations = findVariableObject(languageAst, 'translations');
  const directPhraseMap = findVariableObject(languageAst, 'directPhraseMap');
  const { aiQuotaUiTranslations } = await import(pathToFileURL(aiQuotaTranslationsPath).href);
  const { globalUiTranslations } = await import(pathToFileURL(globalTranslationsPath).href);
  const externalModule = fs.existsSync(externalTranslationsPath)
    ? await import(`${pathToFileURL(externalTranslationsPath).href}?audit=${Date.now()}`)
    : { externalUiTranslations: {} };
  const phrases = new Set();

  Object.values(keyedTranslations.VIE || {}).forEach((value) => phrases.add(normalized(value)));
  Object.keys(directPhraseMap).forEach((value) => phrases.add(normalized(value)));
  Object.keys(aiQuotaUiTranslations).forEach((value) => phrases.add(normalized(value)));
  Object.keys(globalUiTranslations).forEach((value) => phrases.add(normalized(value)));
  Object.keys(externalModule.externalUiTranslations || {}).forEach((value) => phrases.add(normalized(value)));

  return {
    phrases,
    externalTranslations: externalModule.externalUiTranslations || {},
  };
};

const collectSourceFiles = (directory, files = []) => {
  if ([...ignoredDirectories].some((ignored) => directory === ignored)) return files;

  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath, files);
    } else if (sourceFilePattern.test(entry.name) && entryPath !== languageContextPath) {
      files.push(entryPath);
    }
  });

  return files;
};

const isConsoleCall = (node) => node?.type === 'CallExpression'
  && node.callee?.type === 'MemberExpression'
  && node.callee.object?.type === 'Identifier'
  && node.callee.object.name === 'console';

const templateValue = (node) => node.quasis
  .map((quasi, index) => `${quasi.value.cooked || quasi.value.raw}${index < node.expressions.length ? `{{${index}}}` : ''}`)
  .join('');

const addOccurrence = (collection, value, filePath, node, kind) => {
  const phrase = normalized(value);
  if (!phrase || !isVietnamese(phrase)) return;

  const relativePath = path.relative(frontendRoot, filePath).replaceAll('\\', '/');
  const occurrence = {
    file: relativePath,
    line: node.loc?.start.line || 1,
    kind,
  };

  if (!collection.has(phrase)) collection.set(phrase, []);
  collection.get(phrase).push(occurrence);
};

const collectVietnamesePhrases = (filePath, collection) => {
  const ast = parseSource(filePath);

  const visit = (node, ancestors = []) => {
    if (!node || typeof node !== 'object') return;
    if (ancestors.some(isConsoleCall)) return;

    if (node.type === 'JSXText') {
      addOccurrence(collection, node.value, filePath, node, 'jsx-text');
    } else if (node.type === 'StringLiteral') {
      addOccurrence(collection, node.value, filePath, node, 'string');
    } else if (node.type === 'TemplateLiteral') {
      addOccurrence(collection, templateValue(node), filePath, node, 'template');
      return;
    }

    const nextAncestors = [...ancestors, node];
    Object.entries(node).forEach(([key, child]) => {
      if (['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) return;
      if (Array.isArray(child)) {
        child.forEach((item) => visit(item, nextAncestors));
      } else {
        visit(child, nextAncestors);
      }
    });
  };

  visit(ast);
};

const {
  phrases: coveredPhrases,
  externalTranslations,
} = await loadCoveredVietnamesePhrases();
const allPhrases = new Map();
collectSourceFiles(sourceRoot).forEach((filePath) => collectVietnamesePhrases(filePath, allPhrases));

const invalidExternalTranslations = Object.entries(externalTranslations)
  .map(([source, target]) => {
    const issues = [];
    if (typeof target !== 'string' || !target.trim()) issues.push('empty translation');
    if (JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(target || ''))) {
      issues.push('placeholder mismatch');
    }
    if (String(target).includes('⟦I18N_VALUE_')) issues.push('unrestored placeholder');
    return { source, target, issues };
  })
  .filter(({ issues }) => issues.length > 0);

const uncovered = [...allPhrases.entries()]
  .filter(([phrase]) => !coveredPhrases.has(phrase))
  .map(([phrase, occurrences]) => ({ phrase, occurrences }))
  .sort((left, right) => {
    const fileOrder = left.occurrences[0].file.localeCompare(right.occurrences[0].file);
    if (fileOrder !== 0) return fileOrder;
    return left.occurrences[0].line - right.occurrences[0].line;
  });

export const report = {
  scannedFiles: collectSourceFiles(sourceRoot).length,
  uniqueVietnamesePhrases: allPhrases.size,
  coveredPhrases: allPhrases.size - uncovered.length,
  uncoveredPhrases: uncovered.length,
  uncovered,
  invalidExternalTranslations,
};

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `i18n audit: ${report.coveredPhrases}/${report.uniqueVietnamesePhrases} Vietnamese UI phrases covered across ${report.scannedFiles} files.\n`,
    );
    uncovered.forEach(({ phrase, occurrences }) => {
      const first = occurrences[0];
      process.stdout.write(`${first.file}:${first.line}\t${phrase}\n`);
    });
    invalidExternalTranslations.forEach(({ source, issues }) => {
      process.stdout.write(`invalid external translation\t${issues.join(', ')}\t${source}\n`);
    });
  }

  if (
    process.argv.includes('--check')
    && (uncovered.length > 0 || invalidExternalTranslations.length > 0)
  ) {
    process.exitCode = 1;
  }
}
