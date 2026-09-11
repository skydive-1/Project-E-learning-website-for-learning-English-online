const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

describe('Subtitle VAD Fallback Logic', () => {
  test('gracefully falls back when VAD fails', async () => {
    let vadCalled = false;
    let fallbackCalled = false;

    // Simulate VAD pipeline error (e.g. Missing Python on Railway container)
    const runMockVadPipeline = async () => {
      vadCalled = true;
      throw new Error('spawn python ENOENT: python not found on Railway container');
    };

    const runMockDirectAudio = async () => {
      fallbackCalled = true;
      return [
        { start: '00:00:01,000', end: '00:00:05,000', en: 'Hello world', vi: 'Xin chào thế giới' }
      ];
    };

    let generatedCues = [];
    const vadEnabled = true;
    if (vadEnabled) {
      try {
        generatedCues = await runMockVadPipeline();
      } catch (err) {
        // Fallback gracefully
      }
    }

    if (!generatedCues || generatedCues.length === 0) {
      generatedCues = await runMockDirectAudio();
    }

    assert.strictEqual(vadCalled, true);
    assert.strictEqual(fallbackCalled, true);
    assert.strictEqual(generatedCues.length, 1);
    assert.strictEqual(generatedCues[0].en, 'Hello world');
  });
});
