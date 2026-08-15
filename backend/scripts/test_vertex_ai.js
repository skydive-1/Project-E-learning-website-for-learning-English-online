/**
 * Script Kiểm Thử Gemini 2.5 (Google AI Studio - Chế độ Miễn Phí 100%)
 * 
 * Kiểm tra:
 * 1. Khởi tạo Client Gemini API
 * 2. Gọi thực tế Gemini 2.5 Flash sinh văn bản (Text Generation)
 * 3. Gọi thực tế Gemini 2.5 Flash sinh Stream chunks (SSE)
 * 4. Đếm số lượng Token (countTokens)
 * 5. Tạo vector Embedding 768 chiều (gemini-embedding-001)
 * 
 * Authors:
 * - NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * - NGUYỄN THANH LIÊM (Backend & Security Developer)
 * - LÊ ĐÌNH CHƯƠNG (Database Administrator & Infrastructure Specialist)
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  ai,
  geminiModel,
  embeddingModel,
  pineconeIndex,
  pineconeClient,
  geminiClient
} = require('../src/utils/ai-clients');

async function runTests() {
  console.log('====================================================');
  console.log('🚀 KIỂM THỬ HỆ THỐNG GEMINI 2.5 (CHẾ ĐỘ MIỄN PHÍ 100%)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 5;

  // TEST 1: Kiểm tra Khởi tạo Client & Key
  console.log('👉 [TEST 1/5] Kiểm tra Khởi tạo Client & API Key...');
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('Chưa có GEMINI_API_KEY trong file backend/.env. Vui lòng lấy key miễn phí từ https://aistudio.google.com/app/apikey và dán vào backend/.env');
    }
    console.log('   ✅ Test 1 Thành công: Đã tìm thấy GEMINI_API_KEY.');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 1 Thất bại:', err.message);
  }

  // TEST 2: Gọi thực tế Gemini 2.5 Flash Text Generation
  console.log('\n👉 [TEST 2/5] Kiểm tra Gọi thực tế Gemini 2.5 Flash Generate Content...');
  try {
    const prompt = 'Hãy trả lời ngắn gọn đúng 1 câu: "Hệ thống E-learning AI Gemini 2.5 đang hoạt động miễn phí và ổn định."';
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    console.log(`   Phản hồi thực tế từ Gemini: "${text.trim()}"`);
    if (!text || text.length === 0) {
      throw new Error('Gemini trả về chuỗi rỗng');
    }
    console.log('   ✅ Test 2 Thành công: Gemini 2.5 Flash đã phản hồi văn bản thực tế!');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 2 Thất bại:', err.message);
  }

  // TEST 3: Gọi thực tế Gemini 2.5 Flash Stream
  console.log('\n👉 [TEST 3/5] Kiểm tra Gọi thực tế Gemini 2.5 Flash Generate Content Stream...');
  try {
    const prompt = 'Hãy đếm từ 1 đến 3 bằng tiếng Anh.';
    const resultStream = await geminiModel.generateContentStream(prompt);
    let fullStreamText = '';
    let chunkCount = 0;

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      fullStreamText += chunkText;
      chunkCount++;
    }

    console.log(`   Số chunk nhận được: ${chunkCount}, Nội dung: "${fullStreamText.trim()}"`);
    if (chunkCount === 0 || !fullStreamText) {
      throw new Error('Stream không nhận được chunk nào');
    }
    console.log('   ✅ Test 3 Thành công: Gemini 2.5 Flash Stream hoạt động hoàn hảo!');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 3 Thất bại:', err.message);
  }

  // TEST 4: Đếm Token (countTokens)
  console.log('\n👉 [TEST 4/5] Kiểm tra Token Counting (countTokens)...');
  try {
    const sampleText = 'Welcome to E-learning website for learning English online!';
    const tokenResult = await geminiModel.countTokens(sampleText);
    console.log(`   Số token đếm được: ${tokenResult.totalTokens}`);
    if (typeof tokenResult.totalTokens !== 'number' || tokenResult.totalTokens <= 0) {
      throw new Error('Không tính được số lượng token');
    }
    console.log('   ✅ Test 4 Thành công: Token count middleware tương thích chuẩn xác!');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 4 Thất bại:', err.message);
  }

  // TEST 5: Tạo Vector Embedding 768 chiều (gemini-embedding-001)
  console.log('\n👉 [TEST 5/5] Kiểm tra Embedding Vector 768 Dimensions (gemini-embedding-001)...');
  try {
    const sampleQuery = 'How to practice English speaking with AI?';
    const embedResult = await embeddingModel.embedContent({
      content: { parts: [{ text: sampleQuery }] },
      outputDimensionality: 768
    });
    const values = embedResult.embedding?.values;
    console.log(`   Độ dài vector embedding: ${values?.length || 0} dimensions`);
    if (!values || values.length !== 768) {
      throw new Error(`Độ dài vector ${values?.length} không khớp 768 dimensions của Pinecone index`);
    }
    console.log('   ✅ Test 5 Thành công: Embedding vector 768 chiều khớp 100% với Pinecone!');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 5 Thất bại:', err.message);
  }

  console.log('\n====================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST ĐẠT`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ GEMINI 2.5 ĐÃ HOÀN TẤT THÀNH CÔNG!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
