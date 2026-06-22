from langchain_google_genai import GoogleGenerativeAIEmbeddings

class GeminiEmbedder:
    def __init__(self, api_key, model_name="models/embedding-gecko-001"):
        self.api_key = api_key
        # Tự động nâng cấp model gecko cũ sang model embedding-001 hiện đại của Gemini
        if "gecko" in model_name:
            self.model_name = "models/embedding-001"
        else:
            self.model_name = model_name
        
    def get_embeddings_model(self):
        print(f"🧠 Đang khởi tạo mô hình nhúng Gemini: {self.model_name}...")
        try:
            embeddings = GoogleGenerativeAIEmbeddings(
                google_api_key=self.api_key,
                model=self.model_name
            )
            print("✅ Đã khởi tạo mô hình nhúng thành công!")
            return embeddings
        except Exception as e:
            print(f"❌ Lỗi khi khởi tạo Google Generative AI Embeddings: {e}")
            raise e
