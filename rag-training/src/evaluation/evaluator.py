import os

class RAGEvaluator:
    def __init__(self, docsearch):
        self.docsearch = docsearch
        
    def evaluate_retrieval(self, query, k=3):
        print(f"\n🔍 [Evaluation] Đang kiểm thử tìm kiếm tương đồng với câu hỏi: '{query}'")
        if not self.docsearch:
            print("❌ Không tìm thấy thực thể Vector Store để chạy thử nghiệm.")
            return []
            
        try:
            results = self.docsearch.similarity_search(query, k=k)
            if results:
                print(f"✅ Tìm thấy {len(results)} tài liệu phù hợp nhất:")
                for i, doc in enumerate(results, 1):
                    source = doc.metadata.get("source", "Không rõ nguồn")
                    page = doc.metadata.get("page", 0) + 1
                    snippet = doc.page_content.replace("\n", " ").strip()[:100]
                    print(f"  {i}. [Nguồn: {os.path.basename(source)} - Trang {page}]: \"{snippet}...\"")
                return results
            else:
                print("⚠️ Cảnh báo: Không tìm thấy tài liệu liên quan phù hợp.")
                return []
        except Exception as e:
            print(f"❌ Gặp sự cố khi chạy hàm kiểm tra chất lượng tìm kiếm: {e}")
            return []
