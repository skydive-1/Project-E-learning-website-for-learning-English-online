import requests
from typing import List
from langchain_core.embeddings import Embeddings

class CustomGeminiEmbeddings(Embeddings):
    def __init__(self, api_key: str, model: str = "models/gemini-embedding-001", dimension: int = 768):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension

    def _embed(self, text: str) -> List[float]:
        model_path = self.model
        if not model_path.startswith("models/"):
            model_path = f"models/{model_path}"
            
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_path}:embedContent?key={self.api_key}"
        payload = {
            "content": {
                "parts": [{"text": text}]
            },
            "outputDimensionality": self.dimension
        }
        res = requests.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Failed to generate embedding: {res.text}")
        data = res.json()
        return data["embedding"]["values"]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)

class GeminiEmbedder:
    def __init__(self, api_key, model_name="models/gemini-embedding-001"):
        self.api_key = api_key
        # Tự động nâng cấp model gecko cũ sang model gemini-embedding-001 hiện đại của Gemini
        if "gecko" in model_name:
            self.model_name = "models/gemini-embedding-001"
        else:
            self.model_name = model_name
        
    def get_embeddings_model(self):
        print(f"🧠 Đang khởi tạo mô hình nhúng Gemini Custom: {self.model_name}...")
        try:
            embeddings = CustomGeminiEmbeddings(
                api_key=self.api_key,
                model=self.model_name,
                dimension=768
            )
            print("✅ Đã khởi tạo mô hình nhúng thành công!")
            return embeddings
        except Exception as e:
            print(f"❌ Lỗi khi khởi tạo Google Generative AI Embeddings: {e}")
            raise e
