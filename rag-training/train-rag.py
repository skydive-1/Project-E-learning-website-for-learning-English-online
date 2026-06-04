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
