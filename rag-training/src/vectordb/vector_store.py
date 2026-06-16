import pinecone
from langchain.vectorstores import Pinecone

class PineconeVectorStore:
    def __init__(self, api_key, environment, index_name):
        self.api_key = api_key
        self.environment = environment
        self.index_name = index_name
        
    def initialize(self):
        print("🔗 Đang kết nối tới cơ sở dữ liệu Vector Pinecone...")
        try:
            pinecone.init(
                api_key=self.api_key,
                environment=self.environment
            )
            print("✅ Kết nối Pinecone thành công!")
        except Exception as e:
            print(f"❌ Không thể khởi tạo kết nối Pinecone: {e}")
            raise e
            
    def upload_documents(self, chunks, embeddings_model):
        if not chunks:
            print("⚠️ Không có chunks nào để tải lên Pinecone.")
            return None
            
        print(f"📤 Đang upload {len(chunks)} vectors lên index: {self.index_name}...")
        try:
            docsearch = Pinecone.from_documents(
                chunks,
                embeddings_model,
                index_name=self.index_name
            )
            print("✅ Tải dữ liệu vector lên Pinecone hoàn tất!")
            return docsearch
        except Exception as e:
            print(f"❌ Lỗi xảy ra khi tải vector lên Pinecone: {e}")
            raise e
