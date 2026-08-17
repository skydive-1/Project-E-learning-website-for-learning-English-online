/**
 * Utility trích xuất toàn bộ nội dung text từ file PDF
 */
const fs = require('fs');

async function extractTextFromPdf(filePathOrBuffer) {
  try {
    let buffer;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      buffer = filePathOrBuffer;
    } else if (typeof filePathOrBuffer === 'string' && fs.existsSync(filePathOrBuffer)) {
      buffer = fs.readFileSync(filePathOrBuffer);
    } else {
      return '';
    }

    const pdfParseModule = require('pdf-parse');

    // 1. pdf-parse v2 (Class PDFParse)
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const result = await parser.getText();
      return result?.text || '';
    }

    // 2. pdf-parse v1 (Function default)
    if (typeof pdfParseModule === 'function') {
      const result = await pdfParseModule(buffer);
      return result?.text || '';
    }

    return '';
  } catch (error) {
    console.warn('[PDF Extractor] Cảnh báo lỗi trích xuất text PDF:', error.message);
    return '';
  }
}

module.exports = {
  extractTextFromPdf
};
