import pinecone
from pinecone import Pinecone as PineconeClient

# Patch pinecone.list_indexes for compatibility between langchain-community and pinecone-client 3.x
if not hasattr(pinecone, 'list_indexes'):
    def _patched_list_indexes():
        import os
        api_key = os.environ.get("PINECONE_API_KEY")
        if not api_key:
            return []
        try:
            pc = PineconeClient(api_key=api_key)
            return [idx.name for idx in pc.list_indexes()]
        except Exception:
            return []
    pinecone.list_indexes = _patched_list_indexes

from langchain_community.vectorstores import Pinecone

class PineconeVectorStore:
    def __init__(self, api_key, environment, index_name):
        self.api_key = api_key
        self.environment = environment
        self.index_name = index_name
        
    def initialize(self):
        print("🔗 Đang kết nối tới cơ sở dữ liệu Vector Pinecone...")
        try:
            self.pc = PineconeClient(api_key=self.api_key)
            print("✅ Kết nối Pinecone thành công!")
            
            # Tự động kiểm tra và tạo index nếu chưa tồn tại
            try:
                existing_indexes = [idx.name for idx in self.pc.list_indexes()]
                if self.index_name not in existing_indexes:
                    print(f"➕ Không tìm thấy index '{self.index_name}' trên Pinecone. Đang tiến hành tạo mới...")
                    from pinecone import ServerlessSpec
                    self.pc.create_index(
                        name=self.index_name,
                        dimension=768, # Hợp lệ cho models/embedding-001 của Gemini
                        metric="cosine",
                        spec=ServerlessSpec(
                            cloud="aws",
                            region="us-east-1"
                        )
                    )
                    print(f"✅ Đã tạo thành công index '{self.index_name}'. Vui lòng đợi vài giây để index sẵn sàng...")
                    import time
                    time.sleep(5)
                else:
                    print(f"✅ Đã tìm thấy index '{self.index_name}' sẵn có trên Pinecone.")
            except Exception as inner_err:
                print(f"⚠️ Cảnh báo: Không thể kiểm tra hoặc tự động tạo index trên Pinecone: {inner_err}")
                print("Hệ thống sẽ thử chạy tiếp với index cấu hình sẵn.")
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
