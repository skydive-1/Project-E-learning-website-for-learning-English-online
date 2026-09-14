import { describe, expect, it } from 'vitest';
import {
  configureBritishEnglishUtterance,
  getPreferredBritishVoice,
  getBritishVoiceByGender,
  getRandomBritishVoice
} from '../src/utils/britishEnglishTts';

describe('British English TTS', () => {
  it('prioritizes a natural en-GB voice over other English voices', () => {
    const voices = [
      { name: 'Google US English', lang: 'en-US', default: true },
      { name: 'Generic British Voice', lang: 'en-GB' },
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' }
    ];

    expect(getPreferredBritishVoice({ getVoices: () => voices })).toBe(voices[2]);
  });

  it('keeps en-GB as the browser fallback when no British voice is installed', () => {
    const utterance = {};

    configureBritishEnglishUtterance(
      utterance,
      { getVoices: () => [{ name: 'US English', lang: 'en-US' }] },
      { rate: 0.84 }
    );

    expect(utterance).toMatchObject({ lang: 'en-GB', rate: 0.84, pitch: 1 });
    expect(utterance.voice).toBeUndefined();
  });

  it('randomly selects from both known female and male British voice pools', () => {
    const voices = [
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
      { name: 'Microsoft Libby Online (Natural)', lang: 'en-GB' },
      { name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB' },
      { name: 'Google US English', lang: 'en-US' }
    ];
    const speechSynthesis = { getVoices: () => voices };

    expect(getRandomBritishVoice(speechSynthesis, () => 0)).toBe(voices[0]);
    expect(getRandomBritishVoice(speechSynthesis, () => 0.75)).toBe(voices[2]);
  });

  it('correctly selects female and male British voices by gender', () => {
    const voices = [
      { name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB' },
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
      { name: 'Google US English', lang: 'en-US' }
    ];
    const speechSynthesis = { getVoices: () => voices };

    expect(getBritishVoiceByGender(speechSynthesis, 'female')).toBe(voices[1]);
    expect(getBritishVoiceByGender(speechSynthesis, 'male')).toBe(voices[0]);
  });

  it('configures utterance with distinct female and male British settings', () => {
    const voices = [
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
      { name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB' }
    ];
    const speechSynthesis = { getVoices: () => voices };

    const femaleUtterance = {};
    configureBritishEnglishUtterance(femaleUtterance, speechSynthesis, { gender: 'female', rate: 0.88 });
    expect(femaleUtterance.voice).toBe(voices[0]);
    expect(femaleUtterance.pitch).toBe(1.05);

    const maleUtterance = {};
    configureBritishEnglishUtterance(maleUtterance, speechSynthesis, { gender: 'male', rate: 0.88 });
    expect(maleUtterance.voice).toBe(voices[1]);
    expect(maleUtterance.pitch).toBe(0.92);
  });
});
