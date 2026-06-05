async function askChatbot(question) {
  try {
    // 1. Search vectors từ Pinecone
    const context = await pinecone.search(question);
    
    // 2. Generate response từ Gemini
    const response = await gemini.ask(question, context);
    
    return response;
  } catch (error) {
    console.error('Chatbot error:', error);
    
    // 3. Không throw, return error response
    return {
      error: true,
      message: 'Chatbot hiện tạm thời không khả dụng',
      fallback: 'Vui lòng thử lại sau hoặc liên hệ support'
    };
  }
}
