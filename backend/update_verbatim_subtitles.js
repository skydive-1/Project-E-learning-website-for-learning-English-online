/**
 * Update 100% Exact Verbatim Subtitles starting with "I see them", "They know me"...
 */

const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');
const subtitlesService = require('./src/modules/lessons/services/subtitles.service');

const verbatimPronounsCues = [
  {
    id: 1,
    start: 0.0,
    end: 4.2,
    startFormatted: "00:00:00.000",
    endFormatted: "00:00:04.200",
    en: "I see them.",
    vi: "Tôi nhìn thấy họ."
  },
  {
    id: 2,
    start: 4.5,
    end: 9.0,
    startFormatted: "00:00:04.500",
    endFormatted: "00:00:09.000",
    en: "They know me.",
    vi: "Họ biết tôi."
  },
  {
    id: 3,
    start: 9.3,
    end: 14.5,
    startFormatted: "00:00:09.300",
    endFormatted: "00:00:14.500",
    en: "We like you.",
    vi: "Chúng tôi quý bạn."
  },
  {
    id: 4,
    start: 14.8,
    end: 19.5,
    startFormatted: "00:00:14.800",
    endFormatted: "00:00:19.500",
    en: "You help us.",
    vi: "Bạn giúp chúng tôi."
  },
  {
    id: 5,
    start: 19.8,
    end: 25.0,
    startFormatted: "00:00:19.800",
    endFormatted: "00:00:25.000",
    en: "He calls her.",
    vi: "Anh ấy gọi điện cho cô ấy."
  },
  {
    id: 6,
    start: 25.3,
    end: 30.5,
    startFormatted: "00:00:25.300",
    endFormatted: "00:00:30.500",
    en: "She loves him.",
    vi: "Cô ấy yêu anh ấy."
  },
  {
    id: 7,
    start: 30.8,
    end: 36.5,
    startFormatted: "00:00:30.800",
    endFormatted: "00:00:36.500",
    en: "It belongs to them.",
    vi: "Nó thuộc về họ."
  },
  {
    id: 8,
    start: 36.8,
    end: 42.5,
    startFormatted: "00:00:36.800",
    endFormatted: "00:00:42.500",
    en: "They need it.",
    vi: "Họ cần nó."
  },
  {
    id: 9,
    start: 42.8,
    end: 50.0,
    startFormatted: "00:00:42.800",
    endFormatted: "00:00:50.000",
    en: "Subject pronouns go before verbs, object pronouns go after verbs.",
    vi: "Đại từ chủ ngữ đứng trước động từ, đại từ tân ngữ đứng sau động từ."
  }
];

async function updateVerbatimSubtitles() {
  console.log("=== BẮT ĐẦU CẬP NHẬT PHỤ ĐỀ NGUYÊN VĂN BẮT ĐẦU TỪ 'I SEE THEM' ===");

  // Cập nhật cho bài học 27, 25, 21, 16 và tất cả bài học dùng video này
  const lessonIds = [27, 25, 21, 16, 13, 30, 33];
  
  for (const id of lessonIds) {
    await subtitlesService.saveSubtitles(id, {
      cues: verbatimPronounsCues
    });
    console.log(`✅ Đã cập nhật phụ đề chuẩn 'I see them' cho bài học ID ${id}`);
  }

  // Xuất file .vtt, .srt, .json
  const subDir = path.join(__dirname, 'uploads/courses/videos/subtitles');
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

  const baseName = 'HuyenBe_Grammar14_Les3_Sec1-1783478966130-703284249';
  const vttPath = path.join(subDir, baseName + '.vtt');
  const srtPath = path.join(subDir, baseName + '.srt');
  const jsonPath = path.join(subDir, baseName + '.json');

  const vttContent = `WEBVTT\n\n` + verbatimPronounsCues.map((c, i) => 
    `${i + 1}\n${c.startFormatted} --> ${c.endFormatted}\n${c.en}\n${c.vi}\n`
  ).join('\n');

  const srtContent = verbatimPronounsCues.map((c, i) => 
    `${i + 1}\n${c.startFormatted.replace('.', ',')} --> ${c.endFormatted.replace('.', ',')}\n${c.en}\n`
  ).join('\n');

  fs.writeFileSync(vttPath, vttContent, 'utf8');
  fs.writeFileSync(srtPath, srtContent, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ cues: verbatimPronounsCues }, null, 2), 'utf8');

  console.log("✅ Đã cập nhật xong tệp VTT và CSDL với câu mở đầu chính xác: 'I see them.'");
  process.exit(0);
}

updateVerbatimSubtitles().catch(err => {
  console.error("Lỗi:", err);
  process.exit(1);
});
