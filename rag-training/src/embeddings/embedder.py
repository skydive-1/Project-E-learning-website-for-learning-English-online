from langchain.embeddings import GooglePalmEmbeddings

class GeminiEmbedder:
    def __init__(self, api_key, model_name="models/embedding-gecko-001"):
        self.api_key = api_key
        self.model_name = model_name
        
    def get_embeddings_model(self):
        print(f"🧠 Đang khởi tạo mô hình nhúng Gemini: {self.model_name}...")
        try:
            embeddings = GooglePalmEmbeddings(
                google_api_key=self.api_key,
                model_name=self.model_name
            )
            print("✅ Đã khởi tạo mô hình nhúng thành công!")
            return embeddings
        except Exception as e:
            print(f"❌ Lỗi khi khởi tạo Google Generative AI Embeddings: {e}")
            raise e
