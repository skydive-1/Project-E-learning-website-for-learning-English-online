export const fixUtf8Mojibake = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  try {
    if (/[ÃÂáÁàÀảẢãÃạẠéÉèÈẻẺẽẼẹẸíÍìÌỉỈĩĨịỊóÓòÒỏỎõÕọỌúÚùÙủỦũŨụỤýÝỳỲỷỶỹỸỵỴ]/.test(str)) {
      const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (decoded && !decoded.includes('\ufffd')) {
        return decoded;
      }
    }
  } catch (_) {}
  return str;
};
