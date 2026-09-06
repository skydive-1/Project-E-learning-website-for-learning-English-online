import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock DOMMatrix for pdfjs-dist / react-pdf in Node jsdom
if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
  if (typeof window !== 'undefined') {
    window.DOMMatrix = global.DOMMatrix;
  }
}

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

// jsdom does not implement matchMedia. Media UI libraries such as Plyr read
// it during module initialization to detect pointer and motion capabilities.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

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

// Mock ResizeObserver for JSDOM
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.ResizeObserver = global.ResizeObserver;
}

