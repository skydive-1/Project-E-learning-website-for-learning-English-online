import os
import yaml
from dotenv import load_dotenv

class RAGConfig:
    def __init__(self, config_path="config.yaml"):
        # Load biến môi trường từ .env
        load_dotenv()
        
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY")
        self.pinecone_env = os.getenv("PINECONE_ENV")
        self.pinecone_index_name = os.getenv("PINECONE_INDEX_NAME")
        
        # Tải cấu hình từ config.yaml
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"❌ Không tìm thấy file cấu hình: {config_path}")
            
        with open(config_path, "r", encoding="utf-8") as f:
            yaml_config = yaml.safe_load(f)
            
        self.chunk_size = yaml_config.get("rag", {}).get("chunk_size", 1000)
        self.chunk_overlap = yaml_config.get("rag", {}).get("chunk_overlap", 100)
        self.data_folder = yaml_config.get("rag", {}).get("data_folder", "./data")
        self.embedding_model = yaml_config.get("models", {}).get("embedding", "models/embedding-gecko-001")
        
    def validate(self):
        if not self.gemini_api_key:
            raise ValueError("❌ Thiếu GEMINI_API_KEY trong .env")
        if not self.pinecone_api_key:
            raise ValueError("❌ Thiếu PINECONE_API_KEY trong .env")
        if not self.pinecone_index_name:
            raise ValueError("❌ Thiếu PINECONE_INDEX_NAME trong .env")
        print("✅ Cấu hình và API keys hợp lệ!")
