from langchain.text_splitter import RecursiveCharacterTextSplitter

class TextChunker:
    def __init__(self, chunk_size, chunk_overlap):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def split_documents(self, documents):
        if not documents:
            return []
            
        print(f"✂️ Đang tiến hành cắt nhỏ tài liệu (chunk_size={self.chunk_size}, overlap={self.chunk_overlap})...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap
        )
        
        chunks = text_splitter.split_documents(documents)
        print(f"✅ Đã cắt thành công thành {len(chunks)} chunks")
        return chunks
