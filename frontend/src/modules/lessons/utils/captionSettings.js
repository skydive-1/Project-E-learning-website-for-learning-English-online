export const CAPTION_SETTINGS_STORAGE_KEY = 'elearn.caption-settings.v1';

export const FONT_FAMILY_OPTIONS = [
  { value: 'Outfit, ui-sans-serif, system-ui, sans-serif', label: 'Outfit' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Georgia, Times New Roman, serif', label: 'Georgia' },
  { value: 'Trebuchet MS, Arial, sans-serif', label: 'Trebuchet MS' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' }
];

export const CHARACTER_EDGE_OPTIONS = [
  { value: 'none', label: 'Không có' },
  { value: 'drop-shadow', label: 'Đổ bóng' },
  { value: 'outline', label: 'Viền ngoài' },
  { value: 'raised', label: 'Nổi' },
  { value: 'depressed', label: 'Chìm' }
];

export const DEFAULT_CAPTION_SETTINGS = Object.freeze({
  fontFamily: FONT_FAMILY_OPTIONS[0].value,
  fontColor: '#ffffff',
  fontSize: 100,
  fontOpacity: 100,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  windowColor: '#020617',
  windowOpacity: 85,
  characterEdge: 'drop-shadow'
});

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''));

const clampPercent = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

const clampFontSize = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CAPTION_SETTINGS.fontSize;
  return Math.min(200, Math.max(50, Math.round(parsed / 25) * 25));
};

export function normalizeCaptionSettings(value = {}) {
  const allowedFonts = new Set(FONT_FAMILY_OPTIONS.map(option => option.value));
  const allowedEdges = new Set(CHARACTER_EDGE_OPTIONS.map(option => option.value));

  return {
    fontFamily: allowedFonts.has(value.fontFamily)
      ? value.fontFamily
      : DEFAULT_CAPTION_SETTINGS.fontFamily,
    fontColor: isHexColor(value.fontColor)
      ? value.fontColor.toLowerCase()
      : DEFAULT_CAPTION_SETTINGS.fontColor,
    fontSize: clampFontSize(value.fontSize),
    fontOpacity: clampPercent(value.fontOpacity, DEFAULT_CAPTION_SETTINGS.fontOpacity),
    backgroundColor: isHexColor(value.backgroundColor)
      ? value.backgroundColor.toLowerCase()
      : DEFAULT_CAPTION_SETTINGS.backgroundColor,
    backgroundOpacity: clampPercent(value.backgroundOpacity, DEFAULT_CAPTION_SETTINGS.backgroundOpacity),
    windowColor: isHexColor(value.windowColor)
      ? value.windowColor.toLowerCase()
      : DEFAULT_CAPTION_SETTINGS.windowColor,
    windowOpacity: clampPercent(value.windowOpacity, DEFAULT_CAPTION_SETTINGS.windowOpacity),
    characterEdge: allowedEdges.has(value.characterEdge)
      ? value.characterEdge
      : DEFAULT_CAPTION_SETTINGS.characterEdge
  };
}

export function loadCaptionSettings(storage) {
  try {
    const targetStorage = storage || globalThis.localStorage;
    if (!targetStorage) return { ...DEFAULT_CAPTION_SETTINGS };
    const saved = targetStorage.getItem(CAPTION_SETTINGS_STORAGE_KEY);
    return saved
      ? normalizeCaptionSettings(JSON.parse(saved))
      : { ...DEFAULT_CAPTION_SETTINGS };
  } catch (_) {
    return { ...DEFAULT_CAPTION_SETTINGS };
  }
}

export function saveCaptionSettings(settings, storage) {
  try {
    const targetStorage = storage || globalThis.localStorage;
    if (!targetStorage) return;
    targetStorage.setItem(
      CAPTION_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeCaptionSettings(settings))
    );
  } catch (_) {
    // localStorage có thể bị chặn trong chế độ riêng tư; phụ đề vẫn hoạt động trong phiên hiện tại.
  }
}

export function hexToRgba(hex, opacityPercent) {
  const normalized = isHexColor(hex) ? hex.slice(1) : '000000';
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const alpha = clampPercent(opacityPercent, 100) / 100;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getCharacterEdgeStyle(edge) {
  switch (edge) {
    case 'outline':
      return {
        WebkitTextStroke: '1px rgba(0, 0, 0, 0.95)',
        paintOrder: 'stroke fill'
      };
    case 'raised':
      return {
        textShadow: '-1px -1px 0 rgba(255,255,255,0.6), 1px 1px 0 rgba(0,0,0,0.95)'
      };
    case 'depressed':
      return {
        textShadow: '1px 1px 0 rgba(255,255,255,0.45), -1px -1px 0 rgba(0,0,0,0.95)'
      };
    case 'drop-shadow':
      return {
        textShadow: '0 2px 3px rgba(0,0,0,0.95), 0 1px 1px rgba(0,0,0,0.9)'
      };
    default:
      return { textShadow: 'none' };
  }
}

export function getCaptionVisualStyles(value) {
  const settings = normalizeCaptionSettings(value);

  return {
    settings,
    window: {
      backgroundColor: hexToRgba(settings.windowColor, settings.windowOpacity),
      fontFamily: settings.fontFamily,
      fontSize: `${settings.fontSize}%`
    },
    line: {
      color: hexToRgba(settings.fontColor, settings.fontOpacity),
      backgroundColor: hexToRgba(settings.backgroundColor, settings.backgroundOpacity),
      ...getCharacterEdgeStyle(settings.characterEdge)
    }
  };
}
