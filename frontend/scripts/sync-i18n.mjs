import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { report } from './audit-i18n.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.join(frontendRoot, 'src', 'i18n', 'external-ui-translations.js');
const outputUrl = pathToFileURL(outputPath).href;
const translationEndpoint = process.env.I18N_TRANSLATION_ENDPOINT
  || 'https://translate.googleapis.com/translate_a/single';
const maximumBatchItems = 24;
const maximumBatchCharacters = 3600;
const placeholderPattern = /\{\{(\d+)\}\}/g;
const markerPattern = /\[\[I18N_(\d{4})\]\]\s*([\s\S]*?)(?=\[\[I18N_\d{4}\]\]|$)/g;

const existingTranslations = fs.existsSync(outputPath)
  ? (await import(`${outputUrl}?sync=${Date.now()}`)).externalUiTranslations || {}
  : {};

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const markerFor = (index) => `[[I18N_${String(index).padStart(4, '0')}]]`;

const protectPlaceholders = (value) => value.replace(
  placeholderPattern,
  (_, index) => `⟦I18N_VALUE_${index}⟧`,
);

const restorePlaceholders = (value) => value.replace(
  /⟦\s*I18N[_\s-]*VALUE[_\s-]*(\d+)\s*⟧/gi,
  (_, index) => `{{${index}}}`,
);

const readGoogleTranslation = (payload) => {
  if (!Array.isArray(payload?.[0])) {
    throw new Error('The translation service returned an unexpected response');
  }

  return payload[0]
    .map((segment) => (Array.isArray(segment) ? segment[0] || '' : ''))
    .join('');
};

const parseBatchResponse = (translatedText, expectedCount) => {
  const translations = new Map();

  for (const match of translatedText.matchAll(markerPattern)) {
    translations.set(Number(match[1]), restorePlaceholders(match[2].trim()));
  }

  return Array.from({ length: expectedCount }, (_, index) => translations.get(index) || '');
};

const requestTranslationBatch = async (sources, attempt = 1) => {
  try {
    const requestText = sources
      .map((source, index) => `${markerFor(index)}\n${protectPlaceholders(source)}`)
      .join('\n');
    const requestBody = new URLSearchParams({
      client: 'gtx',
      sl: 'vi',
      tl: 'en',
      dt: 't',
      q: requestText,
    });

    const response = await fetch(translationEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: requestBody,
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const translatedText = readGoogleTranslation(await response.json());
    const translations = parseBatchResponse(translatedText, sources.length);
    const missingTranslation = translations.findIndex((value) => !value);

    if (missingTranslation !== -1) {
      throw new Error(`Missing translation at batch position ${missingTranslation + 1}`);
    }

    return translations;
  } catch (error) {
    if (attempt < 3) {
      await wait(1500 * attempt);
      return requestTranslationBatch(sources, attempt + 1);
    }

    if (sources.length > 1) {
      const middle = Math.ceil(sources.length / 2);
      const left = await requestTranslationBatch(sources.slice(0, middle));
      const right = await requestTranslationBatch(sources.slice(middle));
      return [...left, ...right];
    }

    throw new Error(`Could not translate "${sources[0]}": ${error.message}`);
  }
};

const createBatches = (phrases) => {
  const batches = [];
  let currentBatch = [];
  let currentCharacters = 0;

  phrases.forEach((phrase) => {
    const exceedsItemLimit = currentBatch.length >= maximumBatchItems;
    const exceedsCharacterLimit = currentCharacters + phrase.length > maximumBatchCharacters;

    if (currentBatch.length > 0 && (exceedsItemLimit || exceedsCharacterLimit)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }

    currentBatch.push(phrase);
    currentCharacters += phrase.length;
  });

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
};

const writeTranslations = (translations) => {
  const sortedTranslations = Object.fromEntries(
    Object.entries(translations).sort(([left], [right]) => left.localeCompare(right, 'vi')),
  );
  const fileContents = '// Generated from static UI copy by scripts/sync-i18n.mjs.\n'
    + '// Source strings are sent to an external translation service only when that script is run.\n'
    + '// Hand-written translations override these entries at runtime.\n'
    + `export const externalUiTranslations = ${JSON.stringify(sortedTranslations, null, 2)};\n`;

  fs.writeFileSync(outputPath, fileContents, 'utf8');
};

const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const pendingLimit = Number.parseInt(
  limitArgument?.slice('--limit='.length) || process.env.I18N_SYNC_LIMIT || '',
  10,
);
const pending = report.uncovered
  .map(({ phrase }) => phrase)
  .filter((phrase) => !existingTranslations[phrase])
  .slice(0, Number.isFinite(pendingLimit) && pendingLimit > 0 ? pendingLimit : undefined);
const batches = createBatches(pending);

process.stdout.write(
  `Translating ${pending.length} UI phrases through an external service in ${batches.length} batches.\n`,
);

let completed = 0;
const mergedTranslations = { ...existingTranslations };

for (const [batchIndex, batch] of batches.entries()) {
  const translations = await requestTranslationBatch(batch);
  batch.forEach((source, index) => {
    mergedTranslations[source] = translations[index];
  });
  completed += batch.length;
  writeTranslations(mergedTranslations);

  if ((batchIndex + 1) % 3 === 0 || completed === pending.length) {
    process.stdout.write(
      `Translated ${completed}/${pending.length} phrases (${batchIndex + 1}/${batches.length} batches).\n`,
    );
  }

  await wait(150);
}

process.stdout.write(
  `Wrote ${Object.keys(mergedTranslations).length} translations to ${path.relative(frontendRoot, outputPath)}.\n`,
);
