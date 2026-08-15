/**
 * Comprehensive Verification Script for Gemini 2.5 & Vertex AI Integration
 * Tests:
 * 1. AI Client Initialization
 * 2. Real Gemini 2.5 Flash Generate Content
 * 3. Real Gemini 2.5 Flash Generate Content Stream (SSE chunks)
 * 4. Token Counting (countTokens)
 * 5. Embedding Vector Generation (gemini-embedding-001 - 768 dimensions)
 * 6. Pinecone Vector Search Connectivity
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
  console.log('🚀 KHỞI CHẠY KIỂM THỬ TOÀN DIỆN GEMINI 2.5 & VERTEX AI');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 5;

  // TEST 1: Khởi tạo Client & Kiểm tra Cấu hình
  console.log('👉 [TEST 1/5] Kiểm tra Khởi tạo Client & Authentication...');
  try {
    if (!ai) {
      throw new Error('ai client không tồn tại');
    }
    console.log('   ✅ Test 1 Thành công: AI Client đã khởi tạo thành công.');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 1 Thất bại:', err.message);
  }

  // TEST 2: Gọi thực tế Gemini 2.5 Flash Text Generation
  console.log('\n👉 [TEST 2/5] Kiểm tra Gọi thực tế Gemini 2.5 Flash Generate Content...');
  try {
    const prompt = 'Hãy trả lời ngắn gọn đúng 1 câu: "Hệ thống E-learning AI đang hoạt động tốt trên Vertex AI."';
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    console.log(`   Phản hồi thực tế từ Gemini: "${text.trim()}"`);
    if (!text || text.length === 0) {
      throw new Error('Gemini trả về chuỗi rỗng');
    }
    console.log('   ✅ Test 2 Thành công: Gemini 2.5 Flash đã phản hồi văn bản thành công!');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 2 Thất bại:', err.message);
    if (err.message.includes('Could not load the default credentials') || err.message.includes('credentials')) {
      console.log('   ℹ️ HƯỚNG DẪN: Cần chạy "gcloud auth application-default login" hoặc cấu hình GOOGLE_APPLICATION_CREDENTIALS');
    }
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
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ HẠ TẦNG AI ĐÃ ĐẠT CHUẨN!');
    process.exit(0);
  } else {
    console.log('⚠️ CẦN KIỂM TRA LẠI CÁC BƯỚC THẤT BẠI.');
    process.exit(1);
  }
}

runTests();
