# 🤖 HƯỚNG DẪN TRAIN RAG BẰNG PYTHON (OPTION A - KHUYẾN NGHỊ)

---

## 🎯 GIỚI THIỆU

**Tệp này dành cho:** Q.Anh (Frontend Developer + RAG Engineer)

**Mục tiêu:** Train AI model RAG để Chatbot có thể trả lời câu hỏi tiếng Anh

**Công cụ sử dụng:**
- **LangChain** = Framework để xây dựng RAG
- **Google Gemini API** = LLM (mô hình AI trả lời)
- **Pinecone** = Vector database (lưu embeddings)
- **Python 3.10+** = Ngôn ngữ lập trình

**Tại sao chọn Python?**
- ✅ Dễ hơn Node.js cho RAG
- ✅ Nhiều tutorial, documentation
- ✅ Performance tốt
- ⚠️ Cần cài Python riêng

---

## 📋 DANH SÁCH CÔNG VIỆC

- [ ] Bước 1: Cài đặt Python 3.10+
- [ ] Bước 2: Tạo folder `rag-training`
- [ ] Bước 3: Tạo virtual environment
- [ ] Bước 4: Cài đặt dependencies
- [ ] Bước 5: Setup Pinecone account
- [ ] Bước 6: Setup Google Gemini API key
- [ ] Bước 7: Tạo file `.env`
- [ ] Bước 8: Viết code train RAG
- [ ] Bước 9: Chạy train script
- [ ] Bước 10: Verify embeddings trên Pinecone

---

## 🛠️ BƯỚC 1: CÀI ĐẶT PYTHON 3.10+

### 1.1 Tải Python

1. Truy cập: [https://www.python.org/downloads](https://www.python.org/downloads)
2. Tải phiên bản **3.10+** (ví dụ: 3.11.0)
3. Chạy file cài đặt

### 1.2 Kiểm tra cài đặt

Mở **Command Prompt** và gõ:

```bash
python --version
pip --version
```

**Kết quả mong đợi:**
```
Python 3.11.0
pip 23.0.1
```

Nếu hiện ra version = cài đặt thành công ✅

---

## 📁 BƯỚC 2: TẠO FOLDER `rag-training`

Mở **Command Prompt** và gõ:

```bash
# Giả sử bạn đang trong thư mục project root
mkdir rag-training
cd rag-training
```

**Kết quả:**
```
Project-E-learning-website-for-learning-English-online/
├── frontend/
├── backend/
├── rag-training/        ← Folder mới (bạn đang ở đây)
└── ...
```

---

## 🐍 BƯỚC 3: TẠO VIRTUAL ENVIRONMENT

**Tại sao cần virtual environment?**
- Virtual environment giúp cô lập dependencies của project này
- Không bị ảnh hưởng bởi các project Python khác trên máy

### 3.1 Tạo virtual environment

```bash
# Gõ lệnh này (đang ở trong folder rag-training)
python -m venv venv
```

**Giải thích:**
- `python -m venv` = Tạo virtual environment
- `venv` = Tên folder virtual environment

### 3.2 Kích hoạt virtual environment

**Trên Windows:**
```bash
venv\Scripts\activate
```

**Trên Mac/Linux:**
```bash
source venv/bin/activate
```

**Kết quả:**
- Dòng command prompt sẽ thay đổi thành `(venv) C:\path\rag-training>`
- Mũi tên `(venv)` cho biết virtual environment đã bật ✅

---

## 📦 BƯỚC 4: CÀI ĐẶT DEPENDENCIES

Tạo file **`requirements.txt`** với nội dung sau:

```txt
langchain==0.1.0
langchain-community==0.0.10
google-generativeai==0.3.0
pinecone-client==3.0.0
python-dotenv==1.0.0
pdf2image==1.16.3
pypdf==3.16.0
requests==2.31.0
```

Sau đó cài đặt:

```bash
pip install -r requirements.txt
```

**Giải thích từng package:**
- `langchain` = Framework RAG
- `google-generativeai` = Google Gemini API client
- `pinecone-client` = Pinecone vector database client
- `python-dotenv` = Đọc biến môi trường từ `.env`
- `pdf2image` = Chuyển PDF thành ảnh (tuỳ chọn)
- `pypdf` = Đọc file PDF
- `requests` = HTTP client

**⏳ Cài đặt mất khoảng 3-5 phút**

---

## 📝 BƯỚC 5: SETUP PINECONE ACCOUNT

### 5.1 Tạo tài khoản Pinecone

1. Truy cập: [https://www.pinecone.io](https://www.pinecone.io)
2. Click **"Sign Up"**
3. Đăng ký bằng email hoặc Google
4. Xác nhận email

### 5.2 Tạo Pinecone Index

1. Đăng nhập vào Pinecone dashboard
2. Click **"Create Index"**
3. **Index name:** `elearning-rag`
4. **Dimension:** `768` (kích thước vector từ Gemini embedding model)
5. **Metric:** `cosine` (cách so sánh vectors)
6. Click **"Create"**

### 5.3 Lấy Pinecone API Key

1. Vào **API Keys** (bên trái menu)
2. Copy **API Key**
3. Copy **Environment** (ví dụ: `us-east-1-aws`)
4. **GHI NHỚ 2 cái này!**

---

## 🔑 BƯỚC 6: SETUP GOOGLE GEMINI API KEY

### 6.1 Lấy Gemini API Key

1. Truy cập: [https://ai.google.dev](https://ai.google.dev)
2. Click **"Get API Key"**
3. Click **"Create API Key"**
4. Copy API Key
5. **GHI NHỚ KEY NÀY!**

---

## 🔐 BƯỚC 7: TẠO FILE `.env`

**Tại sao cần `.env`?**
- `.env` lưu trữ các thông tin nhạy cảm (API keys)
- Không được commit lên Git (bảo mật)

### 7.1 Tạo file `.env`

Trong folder `rag-training`, tạo file mới tên: `.env`

**Nội dung:**

```env
# Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_ENV=us-east-1-aws
PINECONE_INDEX_NAME=elearning-rag

# Folder chứa data
DATA_FOLDER=./data
```

**Thay thế:**
- `your-gemini-api-key-here` → API key từ bước 6
- `your-pinecone-api-key-here` → API key từ bước 5
- `us-east-1-aws` → Environment từ bước 5

### 7.2 Tạo file `.gitignore`

**Tại sao?** Để không commit `.env` lên Git

Tạo file `.gitignore` trong folder `rag-training`:

```
.env
venv/
__pycache__/
*.pyc
.DS_Store
```

---

## 💻 BƯỚC 8: VIẾT CODE TRAIN RAG

### 8.1 Tạo file `train-rag.py`

Trong folder `rag-training`, tạo file: `train-rag.py`

**Copy code sau vào file:**

```python
"""
Train RAG Model cho E-learning Chatbot
- Đọc dữ liệu từ PDF, folder, và API
- Tạo embeddings bằng Google Gemini
- Lưu vectors vào Pinecone
"""

import os
from dotenv import load_dotenv
from langchain.document_loaders import DirectoryLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import GooglePalmEmbeddings
from langchain.vectorstores import Pinecone
import pinecone

# 1. Load biến môi trường từ .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV")
PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME")
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data")

# 2. Kiểm tra API keys
if not GEMINI_API_KEY or not PINECONE_API_KEY:
    raise ValueError("❌ Cần GEMINI_API_KEY và PINECONE_API_KEY trong .env")

print("✅ API Keys loaded successfully")

# 3. Khởi tạo Pinecone
try:
    pinecone.init(
        api_key=PINECONE_API_KEY,
        environment=PINECONE_ENV
    )
    print("✅ Pinecone initialized")
except Exception as e:
    print(f"❌ Lỗi kết nối Pinecone: {e}")
    exit(1)

# 4. Tạo thư mục data nếu chưa có
if not os.path.exists(DATA_FOLDER):
    os.makedirs(DATA_FOLDER)
    print(f"⚠️ Folder '{DATA_FOLDER}' được tạo. Hãy thêm file PDF vào đó!")
    exit(0)

# 5. Đọc PDF files
print(f"\n📂 Đang đọc files từ folder: {DATA_FOLDER}")
loader = DirectoryLoader(
    DATA_FOLDER, 
    glob="**/*.pdf",
    loader_cls=PyPDFLoader
)

try:
    documents = loader.load()
    print(f"✅ Đã tải {len(documents)} pages từ PDF files")
except Exception as e:
    print(f"❌ Lỗi đọc PDF: {e}")
    exit(1)

if not documents:
    print("❌ Không tìm thấy PDF files trong folder!")
    print(f"📝 Hãy thêm file .pdf vào folder: {DATA_FOLDER}")
    exit(1)

# 6. Chia nhỏ documents (Chunking)
# - Chia mỗi page thành chunks nhỏ để embeddings chính xác hơn
print("\n✂️ Chia nhỏ documents...")
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,      # Mỗi chunk 1000 ký tự
    chunk_overlap=100     # Overlap 100 ký tự (để giữ context)
)

chunks = text_splitter.split_documents(documents)
print(f"✅ Chia thành {len(chunks)} chunks")

# 7. Tạo embeddings bằng Google Gemini
print("\n🧠 Tạo embeddings bằng Google Gemini...")
try:
    embeddings = GooglePalmEmbeddings(
        google_api_key=GEMINI_API_KEY,
        model_name="models/embedding-gecko-001"
    )
    print("✅ Embeddings model initialized")
except Exception as e:
    print(f"❌ Lỗi tạo embeddings: {e}")
    exit(1)

# 8. Upload vectors vào Pinecone
print(f"\n📤 Upload vectors vào Pinecone (index: {PINECONE_INDEX})...")
try:
    # Tạo vector store từ chunks
    docsearch = Pinecone.from_documents(
        chunks,
        embeddings,
        index_name=PINECONE_INDEX
    )
    print(f"✅ Upload thành công!")
    print(f"📊 Tổng cộng: {len(chunks)} vectors trong Pinecone")
except Exception as e:
    print(f"❌ Lỗi upload: {e}")
    exit(1)

# 9. Test tìm kiếm
print("\n🔍 Test tìm kiếm...")
try:
    test_query = "How to learn English effectively?"
    results = docsearch.similarity_search(test_query, k=3)
    
    if results:
        print(f"✅ Test thành công! Tìm thấy {len(results)} documents liên quan:")
        for i, doc in enumerate(results, 1):
            print(f"\n  {i}. {doc.page_content[:100]}...")
    else:
        print("⚠️ Không tìm thấy documents liên quan (có thể dữ liệu chưa phù hợp)")
except Exception as e:
    print(f"❌ Lỗi test: {e}")

print("\n" + "="*50)
print("✅ TRAIN RAG HOÀN THÀNH!")
print("="*50)
```

---

## 📊 BƯỚC 9: CHUẨN BỊ DỮ LIỆU

### 9.1 Tạo folder `data`

```bash
# Đang ở trong folder rag-training
mkdir data
```

### 9.2 Thêm PDF files

Bạn cần thêm **các file PDF tiếng Anh** vào folder `rag-training/data/`:

**Ví dụ dữ liệu:**
- 📘 Bài học tiếng Anh (từ vựng, ngữ pháp)
- 📗 Tài liệu tham khảo
- 📙 Bài tập và đáp án
- 📕 Ví dụ câu

**Bạn có thể:**
- [ ] Download từ internet (ví dụ: English learning books PDF)
- [ ] Tạo PDF từ Google Docs
- [ ] Dùng content từ website (convert thành PDF)

**Cấu trúc folder:**
```
rag-training/
├── data/
│   ├── lesson-01.pdf
│   ├── lesson-02.pdf
│   ├── vocabulary.pdf
│   └── grammar-rules.pdf
├── venv/
├── train-rag.py
├── requirements.txt
├── .env
└── .gitignore
```

---

## 🚀 BƯỚC 10: CHẠY TRAIN SCRIPT

### 10.1 Chạy script

```bash
# Đảm bảo virtual environment đang bật: (venv) C:\path\rag-training>
python train-rag.py
```

### 10.2 Kết quả mong đợi

```
✅ API Keys loaded successfully
✅ Pinecone initialized
📂 Đang đọc files từ folder: ./data
✅ Đã tải 150 pages từ PDF files
✂️ Chia nhỏ documents...
✅ Chia thành 450 chunks
🧠 Tạo embeddings bằng Google Gemini...
✅ Embeddings model initialized
📤 Upload vectors vào Pinecone (index: elearning-rag)...
✅ Upload thành công!
📊 Tổng cộng: 450 vectors trong Pinecone
🔍 Test tìm kiếm...
✅ Test thành công! Tìm thấy 3 documents liên quan:
  1. English grammar rules for beginners...
  2. Common vocabulary mistakes...
  3. How to improve listening skills...

==================================================
✅ TRAIN RAG HOÀN THÀNH!
==================================================
```

---

## ✅ BƯỚC 11: VERIFY EMBEDDINGS

### 11.1 Kiểm tra Pinecone dashboard

1. Đăng nhập [Pinecone dashboard](https://app.pinecone.io)
2. Vào **Indexes**
3. Click **`elearning-rag`**
4. Bạn sẽ thấy:
   - **Vectors** = số lượng embeddings (ví dụ: 450)
   - **Namespaces** = default (không thay đổi)
   - **Dimension** = 768 (kích thước vector)

---

## 🔄 BƯỚC 12: SAU KHI TRAIN XONG

### 12.1 Cung cấp thông tin cho Liêm

Q.Anh cần gửi cho Liêm:

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

### 12.2 Cập nhật dữ liệu (nếu cần)

Nếu muốn thêm PDF mới:

1. Thêm file PDF vào folder `data/`
2. Chạy lại: `python train-rag.py`
3. Script sẽ cập nhật vectors trong Pinecone

---

## 🐛 TROUBLESHOOTING

| Lỗi | Giải pháp |
|-----|----------|
| `ModuleNotFoundError: No module named 'langchain'` | Cài lại: `pip install -r requirements.txt` |
| `GEMINI_API_KEY not found` | Kiểm tra `.env` file có đúng không |
| `Pinecone authentication failed` | Kiểm tra API Key + Environment trong `.env` |
| `No PDF files found` | Thêm file `.pdf` vào folder `data/` |
| `Connection timeout` | Kiểm tra internet connection |

---

## 📚 TÀI LIỆU THAM KHẢO

- [LangChain Docs](https://python.langchain.com/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [Google Gemini Docs](https://ai.google.dev/docs)
- [RAG Concepts](https://python.langchain.com/docs/use_cases/question_answering/)

---

## 💡 TIPS & TRICKS

✅ **Nên làm:**
- Thêm từ 500-900 PDF pages (tương ứng dự án)
- Tổ chức folder data theo categories (lesson-1/, lesson-2/, v.v.)
- Test query trước khi deploy

❌ **Không nên:**
- Không share API keys lên GitHub
- Không upload PDF không liên quan (ảnh hưởng chất lượng)
- Không chạy script nhiều lần liên tiếp (có thể duplicate vectors)

---

**Chúc Q.Anh thành công! 🚀**

*Tiếp theo: Gửi Pinecone info cho Liêm để tạo API endpoint*
