# 🤖 HƯỚNG DẪN TRAIN RAG BẰNG NODE.JS (OPTION B - CÙNG STACK)

---

## 🎯 GIỚI THIỆU

**Tệp này dành cho:** Q.Anh (Frontend Developer + RAG Engineer) - Nếu chọn Node.js

**Mục tiêu:** Train AI model RAG bằng JavaScript/Node.js (cùng ngôn ngữ với Frontend/Backend)

**Công cụ sử dụng:**
- **LangChain JS** = Framework RAG cho JavaScript
- **Google Gemini API** = LLM (mô hình AI trả lời)
- **Pinecone** = Vector database (lưu embeddings)
- **Node.js 18+** = JavaScript runtime

**Ưu/Nhược điểm Node.js:**
- ✅ Cùng ngôn ngữ với Frontend/Backend
- ✅ Dễ tích hợp vào codebase
- ✅ Có thể chạy trên browser (nếu cần)
- ⚠️ Phức tạp hơn Python một chút
- ⚠️ Ít tutorial hơn Python

---

## 📋 DANH SÁCH CÔNG VIỆC

- [ ] Bước 1: Đảm bảo Node.js 18+ đã cài
- [ ] Bước 2: Tạo folder `rag-training`
- [ ] Bước 3: Khởi tạo Node.js project
- [ ] Bước 4: Cài đặt dependencies
- [ ] Bước 5: Setup Pinecone account
- [ ] Bước 6: Setup Google Gemini API key
- [ ] Bước 7: Tạo file `.env`
- [ ] Bước 8: Viết code train RAG
- [ ] Bước 9: Chuẩn bị dữ liệu (PDF)
- [ ] Bước 10: Chạy train script
- [ ] Bước 11: Verify embeddings

---

## ✅ BƯỚC 1: KIỂM TRA NODE.JS

Mở **Command Prompt** và gõ:

```bash
node --version
npm --version
```

**Kết quả mong đợi:**
```
v18.0.0 (hoặc cao hơn)
9.0.0 (hoặc cao hơn)
```

Nếu chưa cài, hãy cài từ: [https://nodejs.org](https://nodejs.org)

---

## 📁 BƯỚC 2: TẠO FOLDER `rag-training`

```bash
# Giả sử bạn đang trong thư mục project root
mkdir rag-training
cd rag-training
```

---

## 📦 BƯỚC 3: KHỞI TẠO NODE.JS PROJECT

```bash
# Đang ở trong folder rag-training
npm init -y
```

**Kết quả:**
- Tạo file `package.json`

---

## 🔗 BƯỚC 4: CÀI ĐẶT DEPENDENCIES

### 4.1 Cài dependencies

```bash
npm install \
  langchain \
  @langchain/community \
  @google-ai/generativelanguage \
  @langchain/google-genai \
  @pinecone-database/pinecone \
  dotenv \
  pdf-parse \
  node-fetch \
  pdf-lib
```

**Giải thích:**
- `langchain` = Framework RAG
- `@langchain/google-genai` = Google Gemini integration
- `@pinecone-database/pinecone` = Pinecone client
- `dotenv` = Đọc `.env` file
- `pdf-parse` = Đọc PDF
- `node-fetch` = HTTP client
- `pdf-lib` = Xử lý PDF

### 4.2 Kiểm tra cài đặt

```bash
npm list langchain
```

Nếu hiện ra version = cài đặt thành công ✅

---

## 📝 BƯỚC 5: SETUP PINECONE ACCOUNT

Làm giống như **Option A (Python) - Bước 5:**

1. Tạo tài khoản Pinecone
2. Tạo Index: `elearning-rag` (Dimension: 768)
3. Lấy **API Key** và **Environment**

---

## 🔑 BƯỚC 6: SETUP GOOGLE GEMINI API KEY

Làm giống như **Option A (Python) - Bước 6:**

1. Truy cập: [https://ai.google.dev](https://ai.google.dev)
2. Tạo API Key
3. Copy API Key

---

## 🔐 BƯỚC 7: TẠO FILE `.env`

Trong folder `rag-training`, tạo file: `.env`

**Nội dung:**

```env
# Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_ENV=us-east-1-aws
PINECONE_INDEX_NAME=elearning-rag

# Node.js
NODE_ENV=development

# Folder chứa data
DATA_FOLDER=./data
```

### Thay thế:
- `your-gemini-api-key-here` → API key từ bước 6
- `your-pinecone-api-key-here` → API key từ bước 5
- `us-east-1-aws` → Environment từ bước 5

### Tạo `.gitignore`

```
.env
node_modules/
dist/
build/
*.log
.DS_Store
```

---

## 💻 BƯỚC 8: VIẾT CODE TRAIN RAG

### 8.1 Tạo file `train-rag.js`

Trong folder `rag-training`, tạo file: `train-rag.js`

**Copy code sau vào file:**

```javascript
/**
 * Train RAG Model cho E-learning Chatbot
 * - Đọc dữ liệu từ PDF
 * - Tạo embeddings bằng Google Gemini
 * - Lưu vectors vào Pinecone
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

// ===== 1. LOAD ENVIRONMENT VARIABLES =====
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV = process.env.PINECONE_ENV;
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME;
const DATA_FOLDER = process.env.DATA_FOLDER || "./data";

// ===== 2. KIỂM TRA API KEYS =====
if (!GEMINI_API_KEY || !PINECONE_API_KEY) {
  console.error("❌ GEMINI_API_KEY hoặc PINECONE_API_KEY chưa được set trong .env");
  process.exit(1);
}

console.log("✅ API Keys loaded successfully");

// ===== 3. KHỞI TẠO PINECONE =====
let pinecone;
let index;

try {
  pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
    environment: PINECONE_ENV,
  });
  
  index = pinecone.Index(PINECONE_INDEX);
  console.log("✅ Pinecone initialized");
} catch (error) {
  console.error(`❌ Lỗi kết nối Pinecone: ${error.message}`);
  process.exit(1);
}

// ===== 4. TẠO THƯ MỤC DATA NẾU CHƯA CÓ =====
const dataPath = path.join(__dirname, DATA_FOLDER);
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
  console.log(`⚠️ Folder '${DATA_FOLDER}' được tạo. Hãy thêm file PDF vào đó!`);
  process.exit(0);
}

// ===== 5. ĐỌC PDF FILES =====
console.log(`\n📂 Đang đọc files từ folder: ${DATA_FOLDER}`);

const loader = new DirectoryLoader(dataPath, {
  ".pdf": (filePath) => new PDFLoader(filePath),
});

let documents;
try {
  documents = await loader.load();
  console.log(`✅ Đã tải ${documents.length} documents từ PDF files`);
} catch (error) {
  console.error(`❌ Lỗi đọc PDF: ${error.message}`);
  process.exit(1);
}

if (documents.length === 0) {
  console.error("❌ Không tìm thấy PDF files trong folder!");
  console.log(`📝 Hãy thêm file .pdf vào folder: ${dataPath}`);
  process.exit(1);
}

// ===== 6. CHIA NHỎ DOCUMENTS (CHUNKING) =====
console.log("\n✂️ Chia nhỏ documents...");
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,    // Mỗi chunk 1000 ký tự
  chunkOverlap: 100,  // Overlap 100 ký tự (để giữ context)
});

const chunks = await textSplitter.splitDocuments(documents);
console.log(`✅ Chia thành ${chunks.length} chunks`);

// ===== 7. TẠO EMBEDDINGS BẰNG GOOGLE GEMINI =====
console.log("\n🧠 Tạo embeddings bằng Google Gemini...");

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: GEMINI_API_KEY,
  model: "models/embedding-001",
});

console.log("✅ Embeddings model initialized");

// ===== 8. UPLOAD VECTORS VÀO PINECONE =====
console.log(`\n📤 Upload vectors vào Pinecone (index: ${PINECONE_INDEX})...`);

try {
  // Tạo embeddings cho từng chunk
  const vectors = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Tạo embedding cho text
    const embedding = await embeddings.embedQuery(chunk.pageContent);
    
    vectors.push({
      id: `chunk-${i}`,
      values: embedding,
      metadata: {
        text: chunk.pageContent.substring(0, 200),
        source: chunk.metadata.source,
      },
    });
    
    // Log progress
    if ((i + 1) % 10 === 0) {
      console.log(`  ⏳ Processed ${i + 1}/${chunks.length} chunks...`);
    }
  }
  
  // Upsert vectors to Pinecone
  await index.upsert(vectors);
  console.log(`✅ Upload thành công!`);
  console.log(`📊 Tổng cộng: ${vectors.length} vectors trong Pinecone`);
} catch (error) {
  console.error(`❌ Lỗi upload: ${error.message}`);
  process.exit(1);
}

// ===== 9. TEST TÌM KIẾM =====
console.log("\n🔍 Test tìm kiếm...");

try {
  const testQuery = "How to learn English effectively?";
  const queryEmbedding = await embeddings.embedQuery(testQuery);
  
  const results = await index.query({
    vector: queryEmbedding,
    topK: 3,
    includeMetadata: true,
  });
  
  if (results.matches && results.matches.length > 0) {
    console.log(`✅ Test thành công! Tìm thấy ${results.matches.length} documents liên quan:`);
    results.matches.forEach((match, i) => {
      console.log(`\n  ${i + 1}. Score: ${match.score.toFixed(2)}`);
      console.log(`     ${match.metadata?.text || "N/A"}`);
    });
  } else {
    console.warn("⚠️ Không tìm thấy documents liên quan (có thể dữ liệu chưa phù hợp)");
  }
} catch (error) {
  console.error(`❌ Lỗi test: ${error.message}`);
}

// ===== 10. HOÀN THÀNH =====
console.log("\n" + "=".repeat(50));
console.log("✅ TRAIN RAG HOÀN THÀNH!");
console.log("=".repeat(50));
console.log("\n📝 Tiếp theo:");
console.log("1. Gửi Pinecone info cho Liêm (Backend)");
console.log("2. Liêm tạo API endpoint /api/chatbot/ask");
console.log("3. Test Chatbot từ Frontend");
```

### 8.2 Cập nhật `package.json`

Thêm dòng này vào `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "train": "node train-rag.js"
  }
}
```

---

## 📊 BƯỚC 9: CHUẨN BỊ DỮ LIỆU

### 9.1 Tạo folder `data`

```bash
# Đang ở trong folder rag-training
mkdir data
```

### 9.2 Thêm PDF files

Thêm các file PDF tiếng Anh vào folder `rag-training/data/`:

**Ví dụ:**
```
rag-training/
├── data/
│   ├── lesson-01.pdf
│   ├── lesson-02.pdf
│   ├── vocabulary.pdf
│   └── grammar.pdf
├── node_modules/
├── train-rag.js
├── package.json
├── .env
└── .gitignore
```

---

## 🚀 BƯỚC 10: CHẠY TRAIN SCRIPT

```bash
npm run train
```

### Kết quả mong đợi:

```
✅ API Keys loaded successfully
✅ Pinecone initialized
📂 Đang đọc files từ folder: ./data
✅ Đã tải 150 documents từ PDF files
✂️ Chia nhỏ documents...
✅ Chia thành 450 chunks
🧠 Tạo embeddings bằng Google Gemini...
✅ Embeddings model initialized
📤 Upload vectors vào Pinecone (index: elearning-rag)...
  ⏳ Processed 10/450 chunks...
  ⏳ Processed 20/450 chunks...
  ...
✅ Upload thành công!
📊 Tổng cộng: 450 vectors trong Pinecone
🔍 Test tìm kiếm...
✅ Test thành công! Tìm thấy 3 documents liên quan:

  1. Score: 0.92
     English grammar rules for beginners...
  2. Score: 0.87
     Common vocabulary mistakes...
  3. Score: 0.84
     How to improve listening skills...

==================================================
✅ TRAIN RAG HOÀN THÀNH!
==================================================
```

---

## ✅ BƯỚC 11: VERIFY EMBEDDINGS

Làm giống như **Option A (Python) - Bước 11:**

Kiểm tra Pinecone dashboard:
1. Vào [Pinecone dashboard](https://app.pinecone.io)
2. Click **`elearning-rag`**
3. Bạn sẽ thấy:
   - **Vectors** = 450 (hoặc số lượng khác)
   - **Dimension** = 768

---

## 🔄 BƯỚC 12: SAU KHI TRAIN XONG

### Cung cấp thông tin cho Liêm:

```
✅ DONE! RAG Training hoàn thành

Pinecone Info:
- API Key: [COPY từ .env]
- Environment: us-east-1-aws
- Index Name: elearning-rag
- Total Vectors: 450

Gemini API Key: [COPY từ .env]

👉 Liêm cần tạo API endpoint /api/chatbot/ask
   để gọi Pinecone + Gemini
```

---

## 🐛 TROUBLESHOOTING

| Lỗi | Giải pháp |
|-----|----------|
| `Cannot find module 'langchain'` | Cài lại: `npm install langchain` |
| `GEMINI_API_KEY undefined` | Kiểm tra `.env` file |
| `Pinecone authentication error` | Kiểm tra API Key + Environment |
| `No PDF files found` | Thêm file `.pdf` vào folder `data/` |
| `Socket timeout` | Kiểm tra internet connection |
| `Module type error` | Kiểm tra `"type": "module"` trong `package.json` |

---

## 📚 TÀI LIỆU THAM KHẢO

- [LangChain JS Docs](https://js.langchain.com/)
- [Pinecone JS Docs](https://docs.pinecone.io/docs/sdks)
- [Google Gemini JS Docs](https://ai.google.dev/docs/imports_nodejs)

---

## 💡 TIPS

✅ **Nên:**
- Thêm 500-900 PDF pages
- Tổ chức folder data theo categories
- Test query trước deploy

❌ **Không:**
- Không share API keys trên Git
- Không upload PDF không liên quan
- Không chạy script nhiều lần liên tiếp

---

## 🆚 SO SÁNH PYTHON VS NODE.JS

| Tiêu chí | Python | Node.js |
|----------|--------|---------|
| **Dễ học** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Integration** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Documentation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Community** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Khuyến nghị:** Chọn **Python** cho newbie (dễ hơn), chọn **Node.js** nếu muốn tích hợp trực tiếp vào codebase.

---

**Chúc Q.Anh thành công! 🚀**

*Tiếp theo: Gửi Pinecone info cho Liêm để tạo API endpoint*
