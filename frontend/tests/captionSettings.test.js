import { describe, expect, it } from 'vitest';
import {
  CAPTION_SETTINGS_STORAGE_KEY,
  DEFAULT_CAPTION_SETTINGS,
  getCaptionVisualStyles,
  loadCaptionSettings,
  normalizeCaptionSettings,
  saveCaptionSettings
} from '../src/modules/lessons/utils/captionSettings';

function createMemoryStorage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value)
  };
}

describe('caption settings', () => {
  it('normalizes unsafe or out-of-range persisted values', () => {
    const normalized = normalizeCaptionSettings({
      fontFamily: 'url(javascript:bad)',
      fontColor: 'red',
      fontSize: 999,
      fontOpacity: -20,
      characterEdge: 'unknown'
    });

    expect(normalized.fontFamily).toBe(DEFAULT_CAPTION_SETTINGS.fontFamily);
    expect(normalized.fontColor).toBe(DEFAULT_CAPTION_SETTINGS.fontColor);
    expect(normalized.fontSize).toBe(200);
    expect(normalized.fontOpacity).toBe(0);
    expect(normalized.characterEdge).toBe(DEFAULT_CAPTION_SETTINGS.characterEdge);
  });

  it('persists and restores user preferences', () => {
    const storage = createMemoryStorage();
    saveCaptionSettings({ ...DEFAULT_CAPTION_SETTINGS, fontSize: 150 }, storage);

    expect(storage.getItem(CAPTION_SETTINGS_STORAGE_KEY)).toBeTruthy();
    expect(loadCaptionSettings(storage).fontSize).toBe(150);
  });

  it('builds separate text background and caption window colors', () => {
    const styles = getCaptionVisualStyles({
      ...DEFAULT_CAPTION_SETTINGS,
      backgroundColor: '#112233',
      backgroundOpacity: 40,
      windowColor: '#445566',
      windowOpacity: 70
    });

    expect(styles.line.backgroundColor).toBe('rgba(17, 34, 51, 0.4)');
    expect(styles.window.backgroundColor).toBe('rgba(68, 85, 102, 0.7)');
  });
});
