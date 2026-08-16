import sys
import io
import argparse

# Reconfigure stdout and stderr to handle UTF-8 on Windows environments
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from src.config import RAGConfig
from src.ingestion.loader import DocumentLoader
from src.chunking.chunker import TextChunker
from src.embeddings.embedder import GeminiEmbedder
from src.vectordb.vector_store import PineconeVectorStore
from src.evaluation.evaluator import RAGEvaluator

def main():
    parser = argparse.ArgumentParser(description="Pipeline huấn luyện RAG Modular cho bài học E-learning")
    parser.add_argument(
        "--lesson-id", 
        type=int, 
        required=True, 
        help="ID bài học (bắt buộc, ví dụ: --lesson-id 20)"
    )
    parser.add_argument(
        "--data-folder", 
        type=str, 
        default=None, 
        help="Đường dẫn thư mục chứa tài liệu học tập (tùy chọn, ví dụ: --data-folder ./data/lesson20_supplement)"
    )
    args = parser.parse_args()

    print("==================================================")
    print(f"🚀 BẮT ĐẦU CHẠY PIPELINE HUẤN LUYỆN RAG CHO LESSON_ID: {args.lesson_id}")
    print("==================================================")
    
    # 1. Tải cấu hình và biến môi trường
    try:
        config = RAGConfig("config.yaml")
        if args.data_folder:
            config.data_folder = args.data_folder
        config.validate()
    except Exception as e:
        print(f"❌ Lỗi tải cấu hình hệ thống: {e}")
        sys.exit(1)
        
    # 2. Ingestion - Đọc tài liệu
    print(f"📂 Đang quét tài liệu tại: {config.data_folder}")
    loader = DocumentLoader(config.data_folder)
    documents = loader.load_documents()
    if not documents:
        print(f"❌ Không tìm thấy tài liệu nào (.pdf hoặc .txt) trong {config.data_folder}. Dừng pipeline.")
        sys.exit(0)
        
    # 3. Chunking - Cắt nhỏ văn bản
    chunker = TextChunker(config.chunk_size, config.chunk_overlap)
    chunks = chunker.split_documents(documents)
    if not chunks:
        print("⚠️ Không có khối dữ liệu (chunks) nào được phân tách.")
        sys.exit(0)
        
    # 4. Embeddings - Tạo mô hình nhúng
    embedder = GeminiEmbedder(config.gemini_api_key, config.embedding_model)
    embeddings_model = embedder.get_embeddings_model()
    
    # 5. Vector Store - Khởi tạo kết nối và tải vector lên Pinecone
    vector_store = PineconeVectorStore(
        config.pinecone_api_key,
        config.pinecone_env,
        config.pinecone_index_name
    )
    vector_store.initialize()
    docsearch = vector_store.upload_documents(chunks, embeddings_model, args.lesson_id)
    
    # 6. Evaluation - Chạy thử câu hỏi đánh giá độ tương đồng tương đối
    if docsearch:
        evaluator = RAGEvaluator(docsearch)
        evaluator.evaluate_retrieval("How to learn English effectively?")
        evaluator.evaluate_retrieval("What is shadowing method?")
        
    print("\n==================================================")
    print(f"🎉 PIPELINE HUẤN LUYỆN RAG CHO LESSON_ID {args.lesson_id} ĐÃ HOÀN THÀNH XUẤT SẮC!")
    print("==================================================")

if __name__ == "__main__":
    main()
