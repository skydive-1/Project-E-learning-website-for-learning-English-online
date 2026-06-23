import os
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader, TextLoader

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

    def load_documents(self):
        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder)
            print(f"⚠️ Thư mục '{self.data_folder}' được tạo mới. Hãy thêm các file .pdf hoặc .txt vào thư mục này!")
            return []
            
        print(f"📂 Đang quét và đọc tất cả tài liệu (.pdf và .txt) từ thư mục: {self.data_folder}")
        
        documents = []
        
        # Tải PDFs nếu có
        try:
            pdf_loader = DirectoryLoader(
                self.data_folder,
                glob="**/*.pdf",
                loader_cls=PyPDFLoader
            )
            pdf_docs = pdf_loader.load()
            if pdf_docs:
                documents.extend(pdf_docs)
                print(f"✅ Đã tải thành công {len(pdf_docs)} trang tài liệu PDF")
        except Exception as e:
            print(f"⚠️ Lỗi xảy ra khi quét các file PDF: {e}")
            
        # Tải TXTs nếu có
        try:
            txt_loader = DirectoryLoader(
                self.data_folder,
                glob="**/*.txt",
                loader_cls=TextLoader,
                loader_kwargs={'encoding': 'utf-8'}
            )
            txt_docs = txt_loader.load()
            if txt_docs:
                documents.extend(txt_docs)
                print(f"✅ Đã tải thành công {len(txt_docs)} tài liệu văn bản TXT")
        except Exception as e:
            print(f"⚠️ Lỗi xảy ra khi quét các file TXT: {e}")
            
        return documents
