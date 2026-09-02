const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  recordAiUsage,
  runWithAiContext,
  COST_PER_M_TOKENS
} = require('../src/utils/ai-clients');
const db = require('../src/config/database');
const adminService = require('../src/modules/admin/services/admin.service');

describe('AI Usage Tracking and Recording (ai_usage_events)', () => {
  let dbQueries = [];
  const originalQuery = db.query;

  beforeEach(() => {
    dbQueries = [];
  });

  test('COST_PER_M_TOKENS has accurate pricing for Gemini 3.7 Flash and Embedding-001', () => {
    // Giá thật đã verify 2026-09-02 (introductory pricing, hết hạn 31/12/2026):
    // https://ai.google.dev/gemini-api/docs/pricing
    assert.equal(COST_PER_M_TOKENS['gemini-3.7-flash'].input, 0.75);
    assert.equal(COST_PER_M_TOKENS['gemini-3.7-flash'].output, 3.75);
    assert.equal(COST_PER_M_TOKENS['gemini-embedding-001'].input, 0.15);
    assert.equal(COST_PER_M_TOKENS['gemini-embedding-001'].output, 0);
  });

  test('recordAiUsage calculates tokens and cost and inserts into ai_usage_events and user_token_limits', async () => {
    // Mock db.query
    db.query = async (text, params) => {
      dbQueries.push({ text, params });
      return { rows: [] };
    };

    try {
      await recordAiUsage({
        userId: 42,
        purpose: 'chat',
        model: 'gemini-3.7-flash',
        usageMetadata: {
          promptTokenCount: 1000,
          candidatesTokenCount: 500,
          totalTokenCount: 1500
        }
      });

      // Assert 2 queries: INSERT ai_usage_events, UPSERT user_token_limits
      assert.equal(dbQueries.length, 2);

      const [insertEvent, upsertLimits] = dbQueries;
      assert.match(insertEvent.text, /INSERT INTO ai_usage_events/i);
      assert.equal(insertEvent.params[0], 42); // user_id
      assert.equal(insertEvent.params[1], 'chat'); // purpose
      assert.equal(insertEvent.params[2], 'gemini-3.7-flash'); // model
      assert.equal(insertEvent.params[3], 1000); // input_tokens
      assert.equal(insertEvent.params[4], 500); // output_tokens
      assert.equal(insertEvent.params[5], 1500); // total_tokens

      // Cost calculation: (1000 * 0.75 + 500 * 3.75) / 1,000,000 = (750 + 1875) / 1,000,000 = 0.002625 USD
      const expectedCost = (1000 * 0.75 + 500 * 3.75) / 1000000;
      assert.equal(insertEvent.params[6], expectedCost);

      // Verify user_token_limits upsert
      assert.match(upsertLimits.text, /INSERT INTO user_token_limits/i);
      assert.equal(upsertLimits.params[0], 42); // user_id
      assert.equal(upsertLimits.params[1], 1500); // increment amount
    } finally {
      db.query = originalQuery;
    }
  });

  test('recordAiUsage handles alternate SDK usageMetadata field names (inputTokens, outputTokens)', async () => {
    db.query = async (text, params) => {
      dbQueries.push({ text, params });
      return { rows: [] };
    };

    try {
      await recordAiUsage({
        userId: null,
        purpose: 'embedding',
        model: 'gemini-embedding-001',
        usageMetadata: {
          inputTokens: 200,
          outputTokens: 0,
          totalTokens: 200
        }
      });

      assert.equal(dbQueries.length, 1); // No userId => only 1 query
      const [insertEvent] = dbQueries;
      assert.equal(insertEvent.params[0], null); // user_id is null
      assert.equal(insertEvent.params[1], 'embedding');
      assert.equal(insertEvent.params[3], 200); // input
      assert.equal(insertEvent.params[4], 0); // output
      assert.equal(insertEvent.params[5], 200); // total
      // Cost: 200 * 0.15 / 1,000,000 = 0.00003 USD
      assert.equal(insertEvent.params[6], (200 * 0.15) / 1000000);
    } finally {
      db.query = originalQuery;
    }
  });

  test('recordAiUsage never throws if database query fails (resilience check)', async () => {
    db.query = async () => {
      throw new Error('Database connection lost');
    };

    try {
      await assert.doesNotReject(async () => {
        await recordAiUsage({
          userId: 99,
          purpose: 'speaking_stt',
          model: 'gemini-3.7-flash',
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 50, totalTokenCount: 100 }
        });
      });
    } finally {
      db.query = originalQuery;
    }
  });

  test('runWithAiContext sets context that is propagated inside async execution', async () => {
    await runWithAiContext({ userId: 77, purpose: 'subtitle' }, async () => {
      db.query = async (text, params) => {
        dbQueries.push({ text, params });
        return { rows: [] };
      };

      try {
        await recordAiUsage({
          userId: 77,
          purpose: 'subtitle',
          model: 'gemini-3.7-flash',
          usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 100, totalTokenCount: 400 }
        });

        assert.equal(dbQueries.length, 2);
        assert.equal(dbQueries[0].params[0], 77);
        assert.equal(dbQueries[0].params[1], 'subtitle');
      } finally {
        db.query = originalQuery;
      }
    });
  });

  test('admin dashboard calculates real modelBreakdown from ai_usage_events instead of hardcoded 74/18/8%', async () => {
    const originalPoolQuery = db.pool.query;

    db.pool.query = async (text, params) => {
      // Mock summary query
      if (text.includes('FROM bounds, active_ai, chat_stats')) {
        return {
          rows: [{
            total_used_tokens: 10000,
            total_max_tokens: 60000,
            total_remaining_tokens: 50000,
            avg_tokens_per_active_user: 2500,
            exhausted_users_count: 0,
            critical_users_count: 0,
            total_users_with_usage: 4,
            total_questions_rolling_24h: 12,
            active_ai_users_period: 4,
            total_ai_messages_period: 20,
            total_user_prompts_period: 10,
            total_bot_replies_period: 10
          }]
        };
      }
      // Mock trends query
      if (text.includes('daily_usage AS')) {
        return { rows: [] };
      }
      // Mock users query
      if (text.includes('FROM users u')) {
        return { rows: [] };
      }
      // Mock recent logs query
      if (text.includes('FROM ai_chat c')) {
        return { rows: [] };
      }
      // Mock ai_usage_events breakdown query
      if (text.includes('FROM ai_usage_events, bounds')) {
        return {
          rows: [
            { purpose: 'chat', tokens: '6000', cost: '0.0018' },
            { purpose: 'embedding', tokens: '3000', cost: '0.000075' },
            { purpose: 'speaking_stt', tokens: '1000', cost: '0.0003' }
          ]
        };
      }

      return { rows: [] };
    };

    try {
      const dashboard = await adminService.getAiQuotaDashboard(30);

      assert.ok(dashboard.modelBreakdown, 'modelBreakdown must exist');
      assert.equal(dashboard.modelBreakdown.length, 3);

      const flash = dashboard.modelBreakdown.find(m => m.name === 'Gemini 3.7 Flash Reasoning');
      const embedding = dashboard.modelBreakdown.find(m => m.name === 'Gemini Embedding-001 (768D)');
      const speaking = dashboard.modelBreakdown.find(m => m.name === 'Speaking / Voice Multimodal');

      // Total = 6000 + 3000 + 1000 = 10,000 tokens
      // Flash = 6000 / 10000 = 60% (NOT hardcoded 74%)
      // Embedding = 3000 / 10000 = 30% (NOT hardcoded 18%)
      // Speaking = 1000 / 10000 = 10% (NOT hardcoded 8%)
      assert.equal(flash.tokens, 6000);
      assert.equal(flash.share, 60);

      assert.equal(embedding.tokens, 3000);
      assert.equal(embedding.share, 30);

      assert.equal(speaking.tokens, 1000);
      assert.equal(speaking.share, 10);

      // Estimated cost = 0.0018 + 0.000075 + 0.0003 = 0.002175 USD -> 0.0022 USD
      assert.equal(dashboard.summary.estimatedCostUsd, 0.0022);
    } finally {
      db.pool.query = originalPoolQuery;
    }
  });

  test('admin dashboard merges trusted Google history without replacing internal learner quota totals', async () => {
    const originalPoolQuery = db.pool.query;
    let trendsSql = '';
    let breakdownSql = '';

    db.pool.query = async (text) => {
      if (text.includes('FROM bounds, active_ai, chat_stats')) {
        return {
          rows: [{
            total_used_tokens: 5744,
            total_max_tokens: 60000,
            total_remaining_tokens: 54256,
            avg_tokens_per_active_user: 5744,
            exhausted_users_count: 0,
            critical_users_count: 0,
            total_users_with_usage: 1,
            total_questions_rolling_24h: 0,
            active_ai_users_period: 1,
            total_ai_messages_period: 2,
            total_user_prompts_period: 1,
            total_bot_replies_period: 1
          }]
        };
      }
      if (text.includes('historical_usage AS')) {
        trendsSql = text;
        return {
          rows: [
            { day: '2026-08-17', estimated_tokens: 296740, backfilled_tokens: 296740 },
            { day: '2026-09-02', estimated_tokens: 5744, backfilled_tokens: 0 }
          ]
        };
      }
      if (text.includes('FROM users u')) return { rows: [] };
      if (text.includes('FROM ai_chat c')) return { rows: [] };
      if (text.includes('combined_usage AS')) {
        breakdownSql = text;
        return {
          rows: [
            { purpose: 'historical_google_flash', tokens: '210601', cost: '0' },
            { purpose: 'historical_google_embedding', tokens: '86139', cost: '0' },
            { purpose: 'chat', tokens: '5744', cost: '0.0007' }
          ]
        };
      }
      return { rows: [] };
    };

    try {
      const dashboard = await adminService.getAiQuotaDashboard(30);

      assert.equal(dashboard.summary.total_used_tokens, 5744, 'internal learner total remains intact');
      assert.equal(dashboard.summary.total_model_tokens_period, 302484);
      assert.equal(dashboard.summary.backfilled_tokens_period, 296740);
      assert.equal(dashboard.summary.historical_tokens_excluded_from_cost, 296740);
      assert.equal(dashboard.summary.estimatedCostUsd, 0.0007);
      assert.match(trendsSql, /ai_usage_daily_model_history/i);
      assert.match(trendsSql, /h\.is_trusted = TRUE/i);
      assert.match(trendsSql, /NOT EXISTS/i);
      assert.match(breakdownSql, /historical_google_embedding/i);

      const flash = dashboard.modelBreakdown.find(m => m.name === 'Gemini 3.7 Flash Reasoning');
      const embedding = dashboard.modelBreakdown.find(m => m.name === 'Gemini Embedding-001 (768D)');
      assert.equal(flash.tokens, 216345);
      assert.equal(embedding.tokens, 86139);
    } finally {
      db.pool.query = originalPoolQuery;
    }
  });
});
