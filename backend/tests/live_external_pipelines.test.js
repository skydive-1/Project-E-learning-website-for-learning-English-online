/**
 * Live External AI Pipelines Integration Test (Opt-in)
 *
 * Runs only when RUN_LIVE_EXTERNAL_TESTS=true
 * Tests live Gemini audio subtitle pipeline and Gemini embedding/generation.
 *
 * Authors:
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const { runLiveVerification } = require('../scripts/verify_live_external_pipelines');

describe('Live External AI Pipelines Integration (@integration-external)', () => {
  const isEnabled = process.env.RUN_LIVE_EXTERNAL_TESTS === 'true';

  test('executes live verification or skips cleanly when opt-in flag is unset', async () => {
    const result = await runLiveVerification();
    if (!isEnabled) {
      expect(result.skipped).toBe(true);
    } else {
      expect(result.ragEmbedding.passed).toBe(true);
      expect(result.ragGeneration.passed).toBe(true);
    }
  }, 45000);
});
