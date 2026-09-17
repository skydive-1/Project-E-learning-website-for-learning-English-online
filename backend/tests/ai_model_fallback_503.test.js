'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getGeminiModelRoutingStatus,
  resetGeminiModelRouting,
  setPreferredGeminiModel,
  simulateAiModelFallback,
  markModelQuotaExhausted,
  getPrioritizedFallbackModels
} = require('../src/utils/ai-clients');

test('AI Model 503 Fallback and Routing Telemetry Suite', async (t) => {
  await t.test('initializes with default preferred model when reset', () => {
    const routing = resetGeminiModelRouting({ all: true });
    assert.equal(routing.preferredModel, 'gemini-3.7-flash');
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.equal(routing.isFallbackActive, false);
    assert.equal(routing.activeFallbackModel, null);
    assert.equal(routing.fallbackReason, null);
  });

  await t.test('simulates 503 error on preferred model and automatically activates fallback model', () => {
    resetGeminiModelRouting({ all: true });

    const result = simulateAiModelFallback({
      model: 'gemini-3.7-flash',
      simulatedError: 503
    });

    assert.equal(result.success, true);
    assert.equal(result.fromModel, 'gemini-3.7-flash');
    assert.equal(result.toModel, 'gemini-3.6-flash');
    assert.equal(result.errorCode, 503);

    const routing = getGeminiModelRoutingStatus();
    assert.equal(routing.preferredModel, 'gemini-3.7-flash');
    assert.equal(routing.effectiveModel, 'gemini-3.6-flash');
    assert.equal(routing.isFallbackActive, true);
    assert.equal(routing.activeFallbackModel, 'gemini-3.6-flash');
    assert.match(routing.fallbackReason, /503/);
    assert.ok(routing.lastFallbackEvent);
    assert.equal(routing.lastFallbackEvent.fromModel, 'gemini-3.7-flash');
    assert.equal(routing.lastFallbackEvent.toModel, 'gemini-3.6-flash');
  });

  await t.test('restores priority back to preferred model upon reset', () => {
    const routing = resetGeminiModelRouting({ all: true });
    assert.equal(routing.preferredModel, 'gemini-3.7-flash');
    assert.equal(routing.effectiveModel, 'gemini-3.7-flash');
    assert.equal(routing.isFallbackActive, false);
    assert.equal(routing.activeFallbackModel, null);
    assert.equal(routing.coolingDown.length, 0);
  });

  await t.test('automatically shifts to next fallback when a model is marked with 503 service error', () => {
    resetGeminiModelRouting({ all: true });

    markModelQuotaExhausted('gemini-3.7-flash', 30000, 'provider_503_service_error', {
      dimension: '503_unavailable'
    });

    const routing = getGeminiModelRoutingStatus();
    assert.equal(routing.effectiveModel, 'gemini-3.6-flash');
    assert.equal(routing.isFallbackActive, true);
    assert.equal(routing.activeFallbackModel, 'gemini-3.6-flash');
    assert.match(routing.fallbackReason, /503/);
  });
});
