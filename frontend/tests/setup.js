import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Audio API & MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    // Create a 2000 byte buffer to pass size > 1500 check
    const largeBuffer = new Uint8Array(2048);
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob([largeBuffer], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
  static isTypeSupported() {
    return true;
  }
}

global.MediaRecorder = MockMediaRecorder;

// Mock window.AudioContext
class MockAudioContext {
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: (arr) => arr.fill(128),
      disconnect: vi.fn()
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }
  close() {
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext;
window.AudioContext = MockAudioContext;

// Mock HTMLCanvasElement 2D context for jsdom
HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn()
});

// Mock requestAnimationFrame / cancelAnimationFrame
window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock navigator.mediaDevices.getUserMedia
if (!navigator.mediaDevices) {
  navigator.mediaDevices = {};
}
navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{ stop: vi.fn() }]
});

// Mock SpeechSynthesis
window.speechSynthesis = {
  cancel: vi.fn(),
  speak: vi.fn()
};
global.SpeechSynthesisUtterance = vi.fn();
