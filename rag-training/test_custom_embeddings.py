import os
import requests
from typing import List
from langchain_core.embeddings import Embeddings
from dotenv import load_dotenv
load_dotenv()

class CustomGeminiEmbeddings(Embeddings):
    def __init__(self, api_key: str, model: str = "models/gemini-embedding-001", dimension: int = 768):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension

    def _embed(self, text: str) -> List[float]:
        url = f"https://generativelanguage.googleapis.com/v1beta/{self.model}:embedContent?key={self.api_key}"
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

# Test it
api_key = os.environ.get("GEMINI_API_KEY")
try:
    print("Testing CustomGeminiEmbeddings class...")
    embeddings = CustomGeminiEmbeddings(api_key=api_key)
    vec = embeddings.embed_query("Hello world")
    print("SUCCESS! Dimension:", len(vec))
except Exception as e:
    print("FAILED:", e)
