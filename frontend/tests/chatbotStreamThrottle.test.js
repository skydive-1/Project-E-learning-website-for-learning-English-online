import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askChatbotStream } from '../src/modules/chatbot/services/chatbot.service';

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

    // Advance timers incrementally to watch character queue unroll
    await vi.advanceTimersByTimeAsync(20);
    expect(onChunkCalls.length).toBeGreaterThan(0);
    const firstRender = onChunkCalls[0].text;
    expect(firstRender.length).toBeLessThanOrEqual(5);

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

  it('should adaptively increase character release rate when buffer backlog is large', async () => {
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

    // Advance 1 tick
    await vi.advanceTimersByTimeAsync(20);
    // When remaining > 300, step is ceil(remaining / 10) >= 30 chars
    expect(recordedDeltas[0]).toBeGreaterThanOrEqual(25);

    await vi.advanceTimersByTimeAsync(2000);
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
});
