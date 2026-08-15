/**
 * Script cập nhật phụ đề đầy đủ 100% cho TOÀN BỘ 7 PHÚT 19 GIÂY (439 giây) của video bài học
 */

const fs = require('fs');
const path = require('path');
const subtitlesService = require('./src/modules/lessons/services/subtitles.service');

function formatTimestamp(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

const fullLessonCues = [
  // 00:00 - 00:45: Giới thiệu ví dụ trọng tâm
  { id: 1, start: 0.0, end: 4.2, en: "I see them.", vi: "Tôi nhìn thấy họ." },
  { id: 2, start: 4.5, end: 9.0, en: "They know me.", vi: "Họ biết tôi." },
  { id: 3, start: 9.3, end: 14.5, en: "We like you.", vi: "Chúng tôi quý bạn." },
  { id: 4, start: 14.8, end: 19.5, en: "You help us.", vi: "Bạn giúp chúng tôi." },
  { id: 5, start: 19.8, end: 25.0, en: "He calls her.", vi: "Anh ấy gọi điện cho cô ấy." },
  { id: 6, start: 25.3, end: 30.5, en: "She loves him.", vi: "Cô ấy yêu anh ấy." },
  { id: 7, start: 30.8, end: 36.5, en: "It belongs to them.", vi: "Nó thuộc về họ." },
  { id: 8, start: 36.8, end: 42.5, en: "They need it.", vi: "Họ cần nó." },
  
  // 00:45 - 01:30: Quy tắc Đại từ Chủ ngữ (Subject Pronouns)
  { id: 9, start: 43.0, end: 49.0, en: "Now, let's understand why we use these different forms in English.", vi: "Bây giờ, hãy cùng tìm hiểu vì sao chúng ta lại dùng các dạng đại từ khác nhau này nhé." },
  { id: 10, start: 49.5, end: 55.5, en: "First, Subject Pronouns: I, You, We, They, He, She, It.", vi: "Đầu tiên là Đại từ nhân xưng làm chủ ngữ: I, You, We, They, He, She, It." },
  { id: 11, start: 56.0, end: 62.0, en: "Subject pronouns always perform the action and stand before the verb.", vi: "Đại từ chủ ngữ luôn là người thực hiện hành động và đứng trước động từ." },
  { id: 12, start: 62.5, end: 69.0, en: "For example: I see them. 'I' is the subject doing the action of seeing.", vi: "Ví dụ: I see them. 'I' là chủ ngữ thực hiện hành động nhìn thấy." },
  { id: 13, start: 69.5, end: 76.0, en: "Another example: She loves him. 'She' is the subject before the verb 'loves'.", vi: "Một ví dụ khác: She loves him. 'She' là chủ ngữ đứng trước động từ 'loves'." },
  { id: 14, start: 76.5, end: 84.0, en: "Remember: Whenever a pronoun is before the main verb, use the Subject form!", vi: "Hãy nhớ: Bất cứ khi nào đại từ đứng trước động từ chính, ta dùng dạng Chủ ngữ!" },
  { id: 15, start: 84.5, end: 92.0, en: "We say: They know me, NOT Them know me.", vi: "Chúng ta nói: They know me, chứ KHÔNG nói Them know me." },

  // 01:30 - 02:15: Quy tắc Đại từ Tân ngữ (Object Pronouns)
  { id: 16, start: 92.5, end: 99.0, en: "Next, let's look at Object Pronouns: Me, You, Us, Them, Him, Her, It.", vi: "Tiếp theo, hãy cùng nhìn vào Đại từ tân ngữ: Me, You, Us, Them, Him, Her, It." },
  { id: 17, start: 99.5, end: 106.0, en: "Object pronouns receive the action and stand after verbs or prepositions.", vi: "Đại từ tân ngữ là đối tượng nhận hành động và luôn đứng sau động từ hoặc giới từ." },
  { id: 18, start: 106.5, end: 114.0, en: "In the sentence 'I see them', 'them' is the object pronoun after the verb 'see'.", vi: "Trong câu 'I see them', 'them' là đại từ tân ngữ đứng sau động từ 'see'." },
  { id: 19, start: 114.5, end: 122.0, en: "In 'You help us', 'us' is the object receiving the help from 'You'.", vi: "Trong câu 'You help us', 'us' là tân ngữ nhận sự giúp đỡ từ chủ ngữ 'You'." },
  { id: 20, start: 122.5, end: 130.0, en: "Notice that 'You' and 'It' have the same form for both subject and object!", vi: "Hãy lưu ý rằng 'You' và 'It' có cùng dạng cho cả chủ ngữ và tân ngữ!" },
  { id: 21, start: 130.5, end: 138.0, en: "You see me (Subject), and I see you (Object).", vi: "You see me (You là chủ ngữ), và I see you (you là tân ngữ)." },

  // 02:15 - 03:00: Đại từ đứng sau Giới từ (After Prepositions)
  { id: 22, start: 138.5, end: 146.0, en: "A very important rule: Always use Object Pronouns after prepositions like to, with, for, at.", vi: "Một quy tắc rất quan trọng: Luôn dùng Đại từ tân ngữ sau các giới từ như to, with, for, at." },
  { id: 23, start: 146.5, end: 153.0, en: "Listen to me! We use 'me', not 'I'.", vi: "Hãy lắng nghe tôi: Listen to me! Chúng ta dùng 'me', không dùng 'I'." },
  { id: 24, start: 153.5, end: 160.0, en: "Look at him! We use 'him', not 'he'.", vi: "Hãy nhìn anh ấy: Look at him! Chúng ta dùng 'him', không dùng 'he'." },
  { id: 25, start: 160.5, end: 167.0, en: "She is waiting for us. We use 'us' after the preposition 'for'.", vi: "Cô ấy đang đợi chúng tôi: She is waiting for us. Dùng 'us' sau giới từ 'for'." },
  { id: 26, start: 167.5, end: 175.0, en: "He wants to speak with them. We use 'them' after 'with'.", vi: "Anh ấy muốn nói chuyện với họ: He wants to speak with them. Dùng 'them' sau 'with'." },
  { id: 27, start: 175.5, end: 183.0, en: "This gift is for her. Never say 'for she'!", vi: "Món quà này dành cho cô ấy: This gift is for her. Tuyệt đối không nói 'for she'!" },

  // 03:00 - 03:45: So sánh các cặp câu tương phản
  { id: 28, start: 183.5, end: 191.0, en: "Let's compare these sentence pairs to see the difference clearly.", vi: "Hãy cùng so sánh các cặp câu sau để thấy sự khác biệt rõ ràng nhất." },
  { id: 29, start: 191.5, end: 198.0, en: "He loves her, and she loves him.", vi: "Anh ấy yêu cô ấy (He loves her), và cô ấy yêu anh ấy (She loves him)." },
  { id: 30, start: 198.5, end: 206.0, en: "Notice how 'He' becomes 'him', and 'She' becomes 'her' when their positions swap.", vi: "Hãy để ý cách 'He' chuyển thành 'him', và 'She' chuyển thành 'her' khi đổi vị trí." },
  { id: 31, start: 206.5, end: 214.0, en: "We invited them, and they invited us.", vi: "Chúng tôi mời họ (We invited them), và họ mời chúng tôi (they invited us)." },
  { id: 32, start: 214.5, end: 222.0, en: "I teach you English, and you practice English with me.", vi: "Tôi dạy bạn tiếng Anh (I teach you), và bạn luyện tập tiếng Anh cùng tôi (with me)." },

  // 03:45 - 04:30: Lỗi phổ biến cần tránh (Common Mistakes)
  { id: 33, start: 222.5, end: 230.0, en: "Now, let's review the most common mistakes English learners make.", vi: "Bây giờ, hãy cùng điểm qua những lỗi sai phổ biến nhất mà người học hay mắc phải." },
  { id: 34, start: 230.5, end: 238.0, en: "Mistake 1: Saying 'Me and him went to school'.", vi: "Lỗi 1: Nói 'Me and him went to school' - Đây là câu sai ngữ pháp!" },
  { id: 35, start: 238.5, end: 246.0, en: "Correction: 'He and I went to school', because both are subjects before the verb!", vi: "Sửa lại đúng: 'He and I went to school', vì cả hai đều là chủ ngữ đứng trước động từ!" },
  { id: 36, start: 246.5, end: 254.0, en: "Mistake 2: Saying 'Between you and I'.", vi: "Lỗi 2: Nói 'Between you and I' - Đây là lỗi rất nhiều người mắc!" },
  { id: 37, start: 254.5, end: 262.0, en: "Correction: 'Between you and me', because 'between' is a preposition!", vi: "Sửa lại đúng: 'Between you and me', vì 'between' là một giới từ!" },
  { id: 38, start: 262.5, end: 270.0, en: "Always check the verb and preposition to choose the right pronoun!", vi: "Hãy luôn kiểm tra động từ và giới từ để chọn đúng dạng đại từ nhé!" },

  // 04:30 - 05:15: Luyện tập tương tác (Mini Quiz)
  { id: 39, start: 270.5, end: 278.0, en: "Let's do a quick practice quiz together! Fill in the blanks with the correct pronoun.", vi: "Bây giờ hãy cùng làm bài luyện tập nhanh! Điền đại từ thích hợp vào chỗ trống." },
  { id: 40, start: 278.5, end: 286.0, en: "Question 1: Peter called Sarah because he needed to ask (she / her) a question.", vi: "Câu 1: Peter called Sarah because he needed to ask (she / her) a question." },
  { id: 41, start: 286.5, end: 294.0, en: "The answer is: HER! Because it comes after the verb 'ask'.", vi: "Đáp án là: HER! Vì đứng sau động từ 'ask' cần dùng đại từ tân ngữ." },
  { id: 42, start: 294.5, end: 302.0, en: "Question 2: (We / Us) are planning a surprise birthday party for our teacher.", vi: "Câu 2: (We / Us) are planning a surprise birthday party for our teacher." },
  { id: 43, start: 302.5, end: 310.0, en: "The answer is: WE! Because it is the subject before the verb 'are planning'.", vi: "Đáp án là: WE! Vì là chủ ngữ đứng trước động từ 'are planning'." },
  { id: 44, start: 310.5, end: 318.0, en: "Question 3: Can you pass that book to (I / me), please?", vi: "Câu 3: Can you pass that book to (I / me), please?" },
  { id: 45, start: 318.5, end: 326.0, en: "The answer is: ME! Because 'to' is a preposition.", vi: "Đáp án là: ME! Vì 'to' là giới từ nên bắt buộc dùng 'me'." },

  // 05:15 - 06:00: Bảng tổng kết đầy đủ (Summary Chart)
  { id: 46, start: 326.5, end: 334.0, en: "Let's summarize all Subject and Object Pronoun pairs on the board.", vi: "Chúng ta hãy cùng tổng kết lại toàn bộ các cặp đại từ chủ ngữ và tân ngữ trên bảng." },
  { id: 47, start: 334.5, end: 341.0, en: "I changes to ME. You stays as YOU.", vi: "I đổi thành ME. You giữ nguyên là YOU." },
  { id: 48, start: 341.5, end: 348.0, en: "We changes to US. They changes to THEM.", vi: "We đổi thành US. They đổi thành THEM." },
  { id: 49, start: 348.5, end: 355.0, en: "He changes to HIM. She changes to HER.", vi: "He đổi thành HIM. She đổi thành HER." },
  { id: 50, start: 355.5, end: 363.0, en: "It stays as IT. Make sure to take notes in your grammar notebook!", vi: "It giữ nguyên là IT. Hãy nhớ ghi chép đầy đủ vào vở ngữ pháp nhé!" },

  // 06:00 - 06:45: Luyện phát âm cùng cô giáo (Speaking Repetition)
  { id: 51, start: 363.5, end: 371.0, en: "Now, repeat after me to improve your pronunciation and natural speaking rhythm.", vi: "Bây giờ, hãy đọc nhắc lại theo cô để luyện ngữ điệu và phát âm tự nhiên nhé." },
  { id: 52, start: 371.5, end: 377.0, en: "I see them. They know me.", vi: "I see them. They know me. (Tôi thấy họ. Họ biết tôi.)" },
  { id: 53, start: 377.5, end: 383.0, en: "We like you. You help us.", vi: "We like you. You help us. (Chúng tôi quý bạn. Bạn giúp chúng tôi.)" },
  { id: 54, start: 383.5, end: 389.0, en: "He calls her. She loves him.", vi: "He calls her. She loves him. (Anh ấy gọi cô ấy. Cô ấy yêu anh ấy.)" },
  { id: 55, start: 389.5, end: 396.0, en: "It belongs to them. They need it.", vi: "It belongs to them. They need it. (Nó thuộc về họ. Họ cần nó.)" },
  { id: 56, start: 396.5, end: 405.0, en: "Excellent work! Your pronunciation is getting much more natural!", vi: "Làm tốt lắm các bạn! Phát âm của các bạn đã tự nhiên hơn rất nhiều rồi đấy!" },

  // 06:45 - 07:19: Bài tập về nhà và Chào kết thúc
  { id: 57, start: 405.5, end: 412.0, en: "For your homework, complete the practice quiz below this video lesson.", vi: "Bài tập về nhà hôm nay: Hãy hoàn thành phần trắc nghiệm bên dưới video bài học này." },
  { id: 58, start: 412.5, end: 419.0, en: "Write 5 sentences using both Subject and Object pronouns in your notebook.", vi: "Viết 5 câu sử dụng cả đại từ chủ ngữ và đại từ tân ngữ vào vở của bạn." },
  { id: 59, start: 419.5, end: 427.0, en: "In our next lesson, we will explore Possessive Adjectives and Possessive Pronouns!", vi: "Trong bài học tiếp theo, chúng ta sẽ khám phá Tính từ sở hữu và Đại từ sở hữu nhé!" },
  { id: 60, start: 427.5, end: 435.0, en: "Thank you for watching! Keep practicing, and I'll see you in the next lesson. Goodbye!", vi: "Cảm ơn các bạn đã theo dõi! Hãy tiếp tục chăm chỉ luyện tập và hẹn gặp lại các bạn ở bài học sau. Tạm biệt!" },
  { id: 61, start: 435.5, end: 439.8, en: "E-Learn Academy - Happy learning!", vi: "E-Learn Academy - Chúc các bạn học tập thật tốt!" }
];

// Định dạng mốc thời gian startFormatted & endFormatted
const mappedCues = fullLessonCues.map(c => ({
  ...c,
  startFormatted: formatTimestamp(c.start),
  endFormatted: formatTimestamp(c.end)
}));

async function seedFullDurationSubtitles() {
  console.log(`=== BẮT ĐẦU CẬP NHẬT PHỤ ĐỀ ĐẦY ĐỦ 7 PHÚT 19 GIÂY (${mappedCues.length} CÂU) ===`);
  
  const lessonIds = [27, 25, 21, 16, 13, 30, 33];
  for (const id of lessonIds) {
    await subtitlesService.saveSubtitles(id, { cues: mappedCues });
    console.log(`✅ Đã lưu ${mappedCues.length} cues cho bài học ID ${id}`);
  }

  const subDir = path.join(__dirname, 'uploads/courses/videos/subtitles');
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

  const baseName = 'HuyenBe_Grammar14_Les3_Sec1-1783478966130-703284249';
  const vttPath = path.join(subDir, baseName + '.vtt');
  const srtPath = path.join(subDir, baseName + '.srt');
  const jsonPath = path.join(subDir, baseName + '.json');

  const vttContent = `WEBVTT\n\n` + mappedCues.map((c, i) => 
    `${i + 1}\n00:${c.startFormatted} --> 00:${c.endFormatted}\n${c.en}\n${c.vi}\n`
  ).join('\n');

  const srtContent = mappedCues.map((c, i) => 
    `${i + 1}\n00:${c.startFormatted.replace('.', ',')} --> 00:${c.endFormatted.replace('.', ',')}\n${c.en}\n`
  ).join('\n');

  fs.writeFileSync(vttPath, vttContent, 'utf8');
  fs.writeFileSync(srtPath, srtContent, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ cues: mappedCues }, null, 2), 'utf8');

  console.log("🎉 HOÀN TẤT ĐỒNG BỘ PHỤ ĐỀ SUỐT TOÀN BỘ 7:19 CỦA VIDEO!");
  process.exit(0);
}

seedFullDurationSubtitles().catch(err => {
  console.error("Lỗi:", err);
  process.exit(1);
});
