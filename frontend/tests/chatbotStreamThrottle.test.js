import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  askChatbotStream,
  CHATBOT_STREAM_PACING,
  getChatbotStreamRate
} from '../src/modules/chatbot/services/chatbot.service';

describe('Chatbot Stream Client-Side Character Buffer Queue & Throttle', () => {
  let originalFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  function createMockStreamResponse(chunks = []) {
    const encoder = new TextEncoder();
    let chunkIndex = 0;

    const stream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex++];
          controller.enqueue(encoder.encode(chunk));
        } else {
          controller.close();
        }
      }
    });

    return {
      ok: true,
      status: 200,
      body: stream
    };
  }

  it('should buffer received text chunks and release characters smoothly over time', async () => {
    const sseData = [
      'data: ' + JSON.stringify({ type: 'metadata', scope: 'lesson' }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'token', text: 'Xin chào bạn! ' }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'token', text: 'Hôm nay chúng ta học thì hiện tại đơn.' }) + '\n\n',
      'data: [DONE]\n\n'
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseData));

    const onChunkCalls = [];
    const streamPromise = askChatbotStream('Học gì hôm nay?', 1, (text, payload) => {
      onChunkCalls.push({ text, payload });
    });

    // Có một nhịp suy nghĩ ngắn, không xả chữ ngay khi mạng trả về.
    await vi.advanceTimersByTimeAsync(CHATBOT_STREAM_PACING.minimumThinkingMs - 20);
    expect(onChunkCalls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(80);
    expect(onChunkCalls.length).toBeGreaterThan(0);
    const firstRender = onChunkCalls[0].text;
    expect(firstRender.length).toBeLessThanOrEqual(CHATBOT_STREAM_PACING.maximumCharactersPerFrame);

    // Advance more ticks
    await vi.advanceTimersByTimeAsync(300);
    expect(onChunkCalls.length).toBeGreaterThan(5);

    // Finish all timers to drain buffer completely
    await vi.advanceTimersByTimeAsync(2000);
    const result = await streamPromise;

    expect(result.reply).toBe('Xin chào bạn! Hôm nay chúng ta học thì hiện tại đơn.');
    expect(onChunkCalls[onChunkCalls.length - 1].payload.isComplete).toBe(true);
    expect(onChunkCalls[onChunkCalls.length - 1].payload.isTyping).toBe(false);
  });

  it('should cap every rendered chunk even when the buffer backlog is large', async () => {
    const longText = 'A'.repeat(400); // 400 chars backlog
    const sseData = [
      'data: ' + JSON.stringify({ type: 'token', text: longText }) + '\n\n',
      'data: [DONE]\n\n'
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseData));

    const recordedDeltas = [];
    let lastLen = 0;

    const streamPromise = askChatbotStream('Long query', 1, (text) => {
      recordedDeltas.push(text.length - lastLen);
      lastLen = text.length;
    });

    await vi.advanceTimersByTimeAsync(CHATBOT_STREAM_PACING.minimumThinkingMs + 100);
    expect(recordedDeltas.length).toBeGreaterThan(0);
    expect(Math.max(...recordedDeltas)).toBeLessThanOrEqual(CHATBOT_STREAM_PACING.maximumCharactersPerFrame);
    expect(getChatbotStreamRate(10_000)).toBe(CHATBOT_STREAM_PACING.maximumCharactersPerSecond);

    await vi.advanceTimersByTimeAsync(8500);
    const result = await streamPromise;
    expect(result.reply.length).toBe(400);
  });

  it('should handle AbortSignal and clean up ticker interval when aborted', async () => {
    const sseData = [
      'data: ' + JSON.stringify({ type: 'token', text: 'Đang gõ rất dài...' }) + '\n\n'
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseData));

    const abortController = new AbortController();
    const onChunk = vi.fn();

    const streamPromise = askChatbotStream('Test abort', 1, onChunk, 'lesson', null, null, {
      signal: abortController.signal
    });

    await vi.advanceTimersByTimeAsync(40);
    abortController.abort();

    await expect(streamPromise).rejects.toThrow();
  });

  it('preserves structured daily quota errors from the backend', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({
        code: 'AI_QUESTION_LIMIT_REACHED',
        message: 'Bạn đã dùng hết 10 câu hỏi AI trong 24 giờ.',
        quota: { limit: 10, used: 10, remaining: 0 }
      })
    });

    await expect(askChatbotStream('Câu thứ 11', 1, vi.fn())).rejects.toMatchObject({
      code: 'AI_QUESTION_LIMIT_REACHED',
      status: 429,
      quota: { limit: 10, remaining: 0 }
    });
  });
});
