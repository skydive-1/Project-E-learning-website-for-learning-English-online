import os
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader

class DocumentLoader:
    def __init__(self, data_folder):
        self.data_folder = data_folder
        
    def load_pdfs(self):
        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder)
            print(f"⚠️ Thư mục '{self.data_folder}' được tạo mới. Hãy thêm các file .pdf vào thư mục này!")
            return []
            
        print(f"📂 Đang quét và đọc tài liệu PDF từ thư mục: {self.data_folder}")
        loader = DirectoryLoader(
            self.data_folder,
            glob="**/*.pdf",
            loader_cls=PyPDFLoader
        )
        
        try:
            documents = loader.load()
            print(f"✅ Đã tải thành công {len(documents)} trang tài liệu")
            return documents
        except Exception as e:
            print(f"❌ Lỗi xảy ra khi đọc các file PDF: {e}")
            raise e
