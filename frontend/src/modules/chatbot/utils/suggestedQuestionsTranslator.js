/**
 * Suggested Questions Translator
 * Hỗ trợ chuyển ngữ các câu hỏi gợi ý bám sát bài học từ Tiếng Việt sang Tiếng Anh
 * khi người dùng chuyển đổi ngôn ngữ trên Header (VN <-> ENG).
 * 
 * Phụ trách: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 */

const TERM_DICTIONARY = [
  // Ngữ pháp trọng tâm
  ['tính từ đuôi -ed và -ing', '-ed and -ing adjectives'],
  ['tính từ đuôi -ing và -ed', '-ing and -ed adjectives'],
  ['tính từ đuôi -ed', '-ed adjectives'],
  ['tính từ đuôi -ing', '-ing adjectives'],
  ['các loại tính từ', 'adjective types'],
  ['vị trí của tính từ trong câu', 'the position of adjectives in a sentence'],
  ['vị trí của tính từ', 'adjective positions'],
  ['tính từ chỉ cảm xúc', 'emotional adjectives'],
  ['tính từ', 'adjectives'],
  ['động từ to be và danh động từ', 'To Be verbs and gerunds'],
  ['động từ to be', 'To Be verbs'],
  ['danh động từ làm chủ ngữ', 'gerunds as subjects'],
  ['danh động từ', 'gerunds'],
  ['giới từ và trạng từ', 'prepositions and adverbs'],
  ['giới từ', 'prepositions'],
  ['trạng từ', 'adverbs'],
  ['danh từ số ít và số nhiều', 'singular and plural nouns'],
  ['danh từ kết thúc bằng y dài', 'nouns ending in "y"'],
  ['danh từ đếm được và không đếm được', 'countable and uncountable nouns'],
  ['danh từ đếm được', 'countable nouns'],
  ['danh từ không đếm được', 'uncountable nouns'],
  ['danh từ', 'nouns'],
  ['động từ khuyết thiếu', 'modal verbs'],
  ['động từ bất quy tắc', 'irregular verbs'],
  ['động từ', 'verbs'],
  ['thì hiện tại đơn', 'Present Simple tense'],
  ['thì hiện tại tiếp diễn', 'Present Continuous tense'],
  ['thì hiện tại hoàn thành', 'Present Perfect tense'],
  ['thì quá khứ đơn', 'Past Simple tense'],
  ['thì tương lai đơn', 'Future Simple tense'],
  ['câu điều kiện loại 1', 'first conditional'],
  ['câu điều kiện loại 2', 'second conditional'],
  ['câu điều kiện', 'conditionals'],
  ['câu bị động', 'passive voice'],
  ['mệnh đề quan hệ', 'relative clauses'],
  ['câu gián tiếp', 'reported speech'],
  ['câu hỏi đuôi', 'tag questions'],
  ['mạo từ a, an, the', 'articles a, an, the'],
  ['mạo từ', 'articles'],
  ['liên từ', 'conjunctions'],
  ['trọng âm từ', 'word stress'],
  ['ngữ điệu câu', 'sentence intonation'],
  ['nối âm', 'connected speech'],
  ['phát âm từ khó', 'pronouncing difficult words'],
  ['phát âm từ gia đình', 'pronouncing family vocabulary'],
  ['phát âm', 'pronunciation'],

  // Từ vựng chủ đề
  ['từ vựng kiến trúc và xã hội', 'architecture and society vocabulary'],
  ['từ vựng chủ đề nghề nghiệp', 'career-related vocabulary'],
  ['từ vựng nghề nghiệp', 'occupation vocabulary'],
  ['từ vựng tự nhiên', 'natural vocabulary'],
  ['từ vựng hàng ngày', 'everyday vocabulary'],
  ['từ chỉ trường học', 'school-related words'],
  ['từ vựng', 'vocabulary'],
  ['bài học mới', 'the new lesson'],
  ['bài học', 'the lesson']
];

const translateInnerTerms = (text) => {
  let result = text.trim();
  const lower = result.toLowerCase();

  for (const [viTerm, enTerm] of TERM_DICTIONARY) {
    if (lower.includes(viTerm)) {
      const regex = new RegExp(viTerm, 'gi');
      result = result.replace(regex, enTerm);
    }
  }

  // Thay thế bổ trợ cho các từ nối thông dụng
  result = result
    .replace(/\btrong câu\b/gi, 'in a sentence')
    .replace(/\btrong bài\b/gi, 'in this lesson')
    .replace(/\btrong video\b/gi, 'in the video')
    .replace(/\bvào thực tế\b/gi, 'in practice')
    .replace(/\bthực tế\b/gi, 'practice')
    .replace(/\bkhi dùng\b/gi, 'when using')
    .replace(/\bdùng\b/gi, 'using')
    .replace(/\bkhi học\b/gi, 'when learning')
    .replace(/\bgiữa\b/gi, 'between')
    .replace(/\bvà\b/gi, 'and');

  return result.trim();
};

export const translateSuggestedQuestion = (vietnameseQuestion, language = 'VIE') => {
  if (language !== 'ENG' || !vietnameseQuestion || typeof vietnameseQuestion !== 'string') {
    return vietnameseQuestion;
  }

  const q = vietnameseQuestion.trim().replace(/\?+$/, '');

  // Nếu câu hỏi đã là tiếng Anh sẵn (bắt đầu bằng từ để hỏi tiếng Anh)
  if (/^(how|what|why|which|when|where|can|is|are|do|does)\b/i.test(q)) {
    return `${q}?`;
  }

  // 1. Phân biệt chi tiết cách dùng X thế nào?
  let match = q.match(/^Phân biệt chi tiết cách dùng (.+?) thế nào$/i);
  if (match) {
    return `How to distinguish between ${translateInnerTerms(match[1])} in detail?`;
  }

  // 2. Phân biệt cách dùng X thế nào/ra sao?
  match = q.match(/^Phân biệt cách dùng (.+?)(?:\s+thế nào|\s+ra sao)?$/i);
  if (match) {
    return `How to distinguish the usage of ${translateInnerTerms(match[1])}?`;
  }

  // 3. Phân biệt X thế nào/ra sao?
  match = q.match(/^Phân biệt (.+?)(?:\s+thế nào|\s+ra sao)?$/i);
  if (match) {
    return `How to distinguish between ${translateInnerTerms(match[1])}?`;
  }

  // 4. Bản chất khác biệt giữa X và Y là gì?
  match = q.match(/^Bản chất khác biệt giữa (.+?) và (.+?) là gì$/i);
  if (match) {
    return `What is the key difference between ${translateInnerTerms(match[1])} and ${translateInnerTerms(match[2])}?`;
  }

  // 5. Quy tắc sắp xếp thứ tự X trong câu ra sao?
  match = q.match(/^Quy tắc sắp xếp thứ tự (.+?) trong câu ra sao$/i);
  if (match) {
    return `What is the rule for the order of ${translateInnerTerms(match[1])} in a sentence?`;
  }

  // 6. Quy tắc đổi X ra sao?
  match = q.match(/^Quy tắc đổi (.+?) ra sao$/i);
  if (match) {
    return `What is the rule for transforming ${translateInnerTerms(match[1])}?`;
  }

  // 7. Quy tắc X ra sao/thế nào?
  match = q.match(/^Quy tắc (.+?)(?:\s+ra sao|\s+thế nào)?$/i);
  if (match) {
    return `What are the rules for ${translateInnerTerms(match[1])}?`;
  }

  // 8. Đoạn nào trong video giải thích X?
  match = q.match(/^Đoạn nào trong video giải thích (.+?)$/i);
  if (match) {
    return `Which part of the video explains ${translateInnerTerms(match[1])}?`;
  }

  // 9. Đoạn nào trong bài hướng dẫn X?
  match = q.match(/^Đoạn nào trong bài hướng dẫn (.+?)$/i);
  if (match) {
    return `Which part of the lesson explains ${translateInnerTerms(match[1])}?`;
  }

  // 10. Đoạn nào giải thích về X?
  match = q.match(/^Đoạn nào giải thích(?: về)? (.+?)$/i);
  if (match) {
    return `Which part explains ${translateInnerTerms(match[1])}?`;
  }

  // 11. Lỗi sai phổ biến nào học viên thường gặp khi X?
  match = q.match(/^Lỗi sai phổ biến nào học viên thường gặp khi (.+?)$/i);
  if (match) {
    return `What common mistakes do learners make when ${translateInnerTerms(match[1])}?`;
  }

  // 12. Lỗi sai phổ biến khi X là gì?
  match = q.match(/^Lỗi sai phổ biến khi (.+?) là gì$/i);
  if (match) {
    return `What are common mistakes when ${translateInnerTerms(match[1])}?`;
  }

  // 13. Vì sao nói 'X' là sai?
  match = q.match(/^Vì sao nói ['"“](.+?)['"”] là sai$/i);
  if (match) {
    return `Why is saying "${match[1]}" incorrect?`;
  }

  // 14. Làm sao để ghi nhớ nhanh X?
  match = q.match(/^Làm sao để ghi nhớ nhanh (.+?)$/i);
  if (match) {
    return `How to quickly memorize ${translateInnerTerms(match[1])}?`;
  }

  // 15. Mẹo ghi nhớ nhanh X là gì?
  match = q.match(/^Mẹo ghi nhớ nhanh (.+?) là gì$/i);
  if (match) {
    return `What are tips to quickly memorize ${translateInnerTerms(match[1])}?`;
  }

  // 16. Có mẹo gì để nhớ nhanh X không?
  match = q.match(/^Có mẹo gì để nhớ nhanh (.+?) không$/i);
  if (match) {
    return `Are there tips to quickly remember ${translateInnerTerms(match[1])}?`;
  }

  // 17. Cách phát âm và nghĩa của “X”?
  match = q.match(/^Cách phát âm và nghĩa của [“"'](.+?)[”"']$/i);
  if (match) {
    return `Pronunciation and meaning of "${match[1]}"?`;
  }

  // 18. Khi nào nên dùng “X” trong bài?
  match = q.match(/^Khi nào nên dùng [“"'](.+?)[”"'] trong bài$/i);
  if (match) {
    return `When should "${match[1]}" be used in this lesson?`;
  }

  // 19. Cho ví dụ thực tế có “X”?
  match = q.match(/^Cho ví dụ thực tế có [“"'](.+?)[”"']$/i);
  if (match) {
    return `Give real-world examples with "${match[1]}"?`;
  }

  // 20. Lưu ý ngữ pháp về “X” là gì?
  match = q.match(/^Lưu ý ngữ pháp về [“"'](.+?)[”"'] là gì$/i);
  if (match) {
    return `What grammar points to note about "${match[1]}"?`;
  }

  // 21. Khái niệm trọng tâm của "X" là gì?
  match = q.match(/^Khái niệm trọng tâm của [“"'](.+?)[”"'] là gì$/i);
  if (match) {
    return `What is the core concept of "${translateInnerTerms(match[1])}"?`;
  }

  // 22. Cách áp dụng kiến thức "X" vào thực tế?
  match = q.match(/^Cách áp dụng kiến thức [“"'](.+?)[”"'] vào thực tế$/i);
  if (match) {
    return `How to apply "${translateInnerTerms(match[1])}" in practice?`;
  }

  // 23. Những lỗi sai cần tránh khi học "X"?
  match = q.match(/^Những lỗi sai cần tránh khi học [“"'](.+?)[”"']$/i);
  if (match) {
    return `What mistakes should be avoided when learning "${translateInnerTerms(match[1])}"?`;
  }

  // 24. Luyện tập phản xạ và bài tập với "X"?
  match = q.match(/^Luyện tập phản xạ và bài tập với [“"'](.+?)[”"']$/i);
  if (match) {
    return `Reflex practice and exercises for "${translateInnerTerms(match[1])}"?`;
  }

  // Fallback tổng quát nếu là một câu hỏi khác
  const translated = translateInnerTerms(q);
  return `${translated}?`;
};
