import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAudioRecorder from '../src/hooks/useAudioRecorder';

describe('useAudioRecorder Hook Tests (TASK-AI-SPEAKING-01-HOTFIX-R2)', () => {
  let mockMediaRecorderInstance;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock navigator.mediaDevices.getUserMedia
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack]
    };
    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream)
    };

    // Mock MediaRecorder
    mockMediaRecorderInstance = {
      start: vi.fn(),
      stop: vi.fn(function () {
        this.state = 'inactive';
        if (this.onstop) {
          this.onstop();
        }
      }),
      ondataavailable: null,
      onstop: null,
      state: 'recording',
      mimeType: 'audio/webm'
    };

    function MockMediaRecorder() {
      return mockMediaRecorderInstance;
    }
    MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);
    window.MediaRecorder = MockMediaRecorder;

    // Mock AudioContext as constructor
    function MockAudioContext() {
      this.createAnalyser = vi.fn(() => ({
        fftSize: 2048,
        disconnect: vi.fn()
      }));
      this.createMediaStreamSource = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn()
      }));
      this.close = vi.fn();
    }
    window.AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. should start recording and increment time correctly', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordingTime).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.recordingTime).toBe(3);
  });

  it('2. should trigger auto-stop at exactly 120 seconds without losing audioBlob', async () => {
    const onAutoStopMock = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onAutoStop: onAutoStopMock }));

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate audio data chunks collected during recording
    act(() => {
      if (mockMediaRecorderInstance.ondataavailable) {
        mockMediaRecorderInstance.ondataavailable({ data: new Blob(['audio-sample-data'], { type: 'audio/webm' }) });
      }
    });

    // Advance timer to 120 seconds
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });

    expect(mockMediaRecorderInstance.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(onAutoStopMock).toHaveBeenCalledTimes(1);
    const passedBlob = onAutoStopMock.mock.calls[0][0];
    expect(passedBlob).toBeInstanceOf(Blob);
    expect(passedBlob.type).toBe('audio/webm');
  });

  it('3. should prevent duplicate stopRecording calls', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    let blob1, blob2;
    await act(async () => {
      [blob1, blob2] = await Promise.all([
        result.current.stopRecording(),
        result.current.stopRecording()
      ]);
    });

    expect(mockMediaRecorderInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('4. should handle null blob gracefully when recorder was inactive', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    let blob;
    await act(async () => {
      blob = await result.current.stopRecording();
    });

    expect(blob).toBeNull();
  });
});
