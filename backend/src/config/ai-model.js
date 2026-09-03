'use strict';

const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
const DEFAULT_GEMINI_FAST_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GEMINI_SUBTITLE_MODEL = 'gemini-3.6-flash';
const DEFAULT_GEMINI_FALLBACK_MODELS = Object.freeze([
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
]);

const parseModelList = (value, defaults) => {
  const configured = String(value || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return Object.freeze(Array.from(new Set([...configured, ...defaults])));
};

const GEMINI_MODELS = Object.freeze({
  primary: String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
  fast: String(process.env.GEMINI_GLOBAL_CHAT_FAST_MODEL || DEFAULT_GEMINI_FAST_MODEL).trim(),
  subtitle: String(process.env.GEMINI_SUBTITLE_MODEL || DEFAULT_GEMINI_SUBTITLE_MODEL).trim(),
  speaking: String(process.env.GEMINI_SPEAKING_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
  fallbacks: parseModelList(process.env.GEMINI_FALLBACK_MODELS, DEFAULT_GEMINI_FALLBACK_MODELS)
});

module.exports = Object.freeze({
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FAST_MODEL,
  DEFAULT_GEMINI_SUBTITLE_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODELS,
  GEMINI_MODELS
});
