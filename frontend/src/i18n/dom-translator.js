const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT']);

const compactWhitespace = (value) => value.replace(/\s+/g, ' ').trim();
const escapeRegularExpression = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createNormalizedMap = (entries) => {
  const normalized = new Map();
  entries.forEach(([source, target]) => {
    normalized.set(compactWhitespace(source), target);
  });
  return normalized;
};

const createTemplateRules = (entries) => entries
  .filter(([source]) => /\{\{\d+\}\}/.test(source))
  .map(([source, target]) => {
    const compactSource = compactWhitespace(source);
    const placeholderPattern = /\{\{(\d+)\}\}/g;
    const placeholderIndices = [];
    let cursor = 0;
    let expression = '^';

    for (const match of compactSource.matchAll(placeholderPattern)) {
      expression += escapeRegularExpression(compactSource.slice(cursor, match.index));
      expression += '(.+?)';
      placeholderIndices.push(match[1]);
      cursor = match.index + match[0].length;
    }

    expression += `${escapeRegularExpression(compactSource.slice(cursor))}$`;

    return {
      pattern: new RegExp(expression, 'u'),
      placeholderIndices,
      target,
    };
  });

const translateTemplateValue = (source, rules) => {
  for (const rule of rules) {
    const match = source.match(rule.pattern);
    if (!match) continue;

    const values = Object.fromEntries(
      rule.placeholderIndices.map((index, position) => [index, match[position + 1]]),
    );

    return rule.target.replace(
      /\{\{(\d+)\}\}/g,
      (placeholder, index) => values[index] ?? placeholder,
    );
  }

  return null;
};

const preserveOuterWhitespace = (source, translated) => {
  const leading = source.match(/^\s*/)?.[0] || '';
  const trailing = source.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
};

const translateCountPhrase = (value, language) => {
  if (language !== 'ENG') return null;

  const rules = [
    [/^(\d+)\s+bài học$/i, '$1 lessons'],
    [/^(\d+)\s+khóa học$/i, '$1 courses'],
    [/^(\d+)\s+câu hỏi$/i, '$1 questions'],
    [/^(\d+)\s+học viên$/i, '$1 learners'],
    [/^(\d+)\s+phút$/i, '$1 minutes'],
    [/^(\d+)\s+ngày$/i, '$1 days'],
    [/^Trang\s+(\d+)$/i, 'Page $1'],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }

  return null;
};

export const createUiTranslator = (translations) => {
  const translationEntries = Object.entries(translations);
  const viToEn = createNormalizedMap(translationEntries);
  const enToVi = createNormalizedMap(
    translationEntries.map(([vietnamese, english]) => [english, vietnamese]),
  );
  const viToEnTemplateRules = createTemplateRules(translationEntries);

  let activeLanguage = 'VIE';
  let observer;
  let textRecordByNode = new WeakMap();
  let attributeRecordsByElement = new WeakMap();
  let pendingTextWrites = new WeakSet();
  let pendingAttributeWrites = new WeakMap();
  const textRecords = new Set();
  const attributeRecords = new Set();

  const translateValue = (source, language) => {
    if (typeof source !== 'string' || !source.trim()) return source;

    const compactSource = compactWhitespace(source);
    const translated = language === 'ENG'
      ? viToEn.get(compactSource)
        || translateTemplateValue(compactSource, viToEnTemplateRules)
        || translateCountPhrase(compactSource, language)
      : enToVi.get(compactSource);

    return translated ? preserveOuterWhitespace(source, translated) : source;
  };

  const shouldSkipElement = (element) => {
    if (!element) return false;
    return SKIPPED_TAGS.has(element.tagName)
      || element.isContentEditable
      || element.closest?.('[data-i18n-ignore="true"]');
  };

  const removeTextRecord = (record) => {
    textRecords.delete(record);
    textRecordByNode.delete(record.node);
  };

  const removeAttributeRecord = (record) => {
    attributeRecords.delete(record);
    const elementRecords = attributeRecordsByElement.get(record.element);
    elementRecords?.delete(record.attribute);
    if (elementRecords?.size === 0) attributeRecordsByElement.delete(record.element);
  };

  const markAttributeWrite = (element, attribute) => {
    const attributes = pendingAttributeWrites.get(element) || new Set();
    attributes.add(attribute);
    pendingAttributeWrites.set(element, attributes);
  };

  const consumeAttributeWrite = (element, attribute) => {
    const attributes = pendingAttributeWrites.get(element);
    if (!attributes?.has(attribute)) return false;
    attributes.delete(attribute);
    if (attributes.size === 0) pendingAttributeWrites.delete(element);
    return true;
  };

  const applyTextRecord = (record) => {
    if (!record.node.isConnected) {
      removeTextRecord(record);
      return;
    }

    const current = record.node.nodeValue || '';
    if (current !== record.applied) {
      trackTextNode(record.node);
      return;
    }

    const applied = activeLanguage === 'ENG' ? record.english : record.source;
    record.applied = applied;
    if (current !== applied) {
      if (observer) pendingTextWrites.add(record.node);
      record.node.nodeValue = applied;
    }
  };

  const trackTextNode = (node) => {
    const existing = textRecordByNode.get(node);
    if (!node?.parentElement || shouldSkipElement(node.parentElement)) {
      if (existing) removeTextRecord(existing);
      return;
    }

    const current = node.nodeValue || '';
    const source = existing && current === existing.applied ? existing.source : current;
    const english = translateValue(source, 'ENG');

    if (english === source) {
      if (existing) removeTextRecord(existing);
      return;
    }

    const record = existing || { node };
    record.source = source;
    record.english = english;
    record.applied = activeLanguage === 'ENG' ? english : source;

    if (!existing) {
      textRecordByNode.set(node, record);
      textRecords.add(record);
    }

    if (current !== record.applied) {
      if (observer) pendingTextWrites.add(node);
      node.nodeValue = record.applied;
    }
  };

  const readAttribute = (element, attribute) => (
    attribute === 'value' ? element.value : element.getAttribute(attribute) || ''
  );

  const writeAttribute = (element, attribute, value) => {
    if (attribute === 'value') {
      element.value = value;
    } else {
      if (observer) markAttributeWrite(element, attribute);
      element.setAttribute(attribute, value);
    }
  };

  const trackAttribute = (element, attribute) => {
    const elementRecords = attributeRecordsByElement.get(element);
    const existing = elementRecords?.get(attribute);
    const isInputValue = attribute === 'value'
      && element instanceof HTMLInputElement
      && ['button', 'reset', 'submit'].includes(element.type);

    if (
      shouldSkipElement(element)
      || (!isInputValue && !element.hasAttribute(attribute))
      || (isInputValue && !element.value)
    ) {
      if (existing) removeAttributeRecord(existing);
      return;
    }

    const current = readAttribute(element, attribute);
    const source = existing && current === existing.applied ? existing.source : current;
    const english = translateValue(source, 'ENG');

    if (english === source) {
      if (existing) removeAttributeRecord(existing);
      return;
    }

    const record = existing || { element, attribute };
    record.source = source;
    record.english = english;
    record.applied = activeLanguage === 'ENG' ? english : source;

    if (!existing) {
      const nextElementRecords = elementRecords || new Map();
      nextElementRecords.set(attribute, record);
      attributeRecordsByElement.set(element, nextElementRecords);
      attributeRecords.add(record);
    }

    if (current !== record.applied) writeAttribute(element, attribute, record.applied);
  };

  const applyAttributeRecord = (record) => {
    if (!record.element.isConnected) {
      removeAttributeRecord(record);
      return;
    }

    const current = readAttribute(record.element, record.attribute);
    if (current !== record.applied) {
      trackAttribute(record.element, record.attribute);
      return;
    }

    const applied = activeLanguage === 'ENG' ? record.english : record.source;
    record.applied = applied;
    if (current !== applied) writeAttribute(record.element, record.attribute, applied);
  };

  const trackElement = (element) => {
    TRANSLATABLE_ATTRIBUTES.forEach((attribute) => trackAttribute(element, attribute));

    if (
      element instanceof HTMLInputElement
      && ['button', 'reset', 'submit'].includes(element.type)
      && element.value
    ) {
      trackAttribute(element, 'value');
    }
  };

  const trackSubtree = (root) => {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      trackTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      if (shouldSkipElement(root)) return;
      trackElement(root);
    }

    root.childNodes.forEach(trackSubtree);
  };

  const setLanguage = (language) => {
    activeLanguage = language;
    textRecords.forEach(applyTextRecord);
    attributeRecords.forEach(applyAttributeRecord);
  };

  const observe = (root, language) => {
    observer?.disconnect();
    observer = undefined;
    textRecords.clear();
    attributeRecords.clear();
    textRecordByNode = new WeakMap();
    attributeRecordsByElement = new WeakMap();
    pendingTextWrites = new WeakSet();
    pendingAttributeWrites = new WeakMap();
    activeLanguage = language;

    trackSubtree(root);

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          if (pendingTextWrites.has(mutation.target)) {
            pendingTextWrites.delete(mutation.target);
            return;
          }
          trackTextNode(mutation.target);
          return;
        }

        if (mutation.type === 'attributes') {
          if (consumeAttributeWrite(mutation.target, mutation.attributeName)) return;
          trackAttribute(mutation.target, mutation.attributeName);
          return;
        }

        mutation.addedNodes.forEach(trackSubtree);
      });
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES, 'value'],
    });

    return () => {
      observer?.disconnect();
      observer = undefined;
      textRecords.clear();
      attributeRecords.clear();
    };
  };

  return { observe, setLanguage, translateValue };
};
