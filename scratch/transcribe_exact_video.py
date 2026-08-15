#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import subprocess
import json
import time
from dotenv import load_dotenv
load_dotenv('.env')

import google.generativeai as genai
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

ffmpeg_exe = os.path.abspath('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe')
video_path = 'uploads/courses/videos/HuyenBe_Grammar14_Les3_Sec1-1783478966130-703284249.mp4'
wav_path = 'uploads/real_audio_first_90s.wav'

print("1. Đang trích xuất audio 90s từ video thật...", flush=True)
cmd = [ffmpeg_exe, '-y', '-i', video_path, '-vn', '-ac', '1', '-ar', '16000', '-t', '120', wav_path]
subprocess.run(cmd, check=True)

with open(wav_path, 'rb') as f:
    audio_bytes = f.read()

print("2. Đang gửi âm thanh thật cho Gemini 2.5 Flash bóc băng từng từ...", flush=True)
model = genai.GenerativeModel('gemini-2.5-flash')
prompt = """
Hãy nghe thật kỹ âm thanh của video bài giảng này và bóc băng NGUYÊN VĂN 100% từng câu thoại tiếng Anh và giảng giải tiếng Việt mà cô giáo đang nói trong video theo đúng thứ tự thời gian.
Định dạng trả về mảng JSON:
[
  {
    "id": 1,
    "start": 0.0,
    "end": 4.5,
    "startFormatted": "00:00:00.000",
    "endFormatted": "00:00:04.500",
    "en": "...",
    "vi": "..."
  }
]
Quy tắc:
- en: Phiên âm chính xác từng câu ví dụ tiếng Anh (ví dụ: I see them, They know me, v.v.).
- vi: Lời giảng tiếng Việt của cô giáo hoặc bản dịch nghĩa chuẩn xác tương ứng.
Chỉ trả về JSON thuần túy, không có markdown thừa.
"""

resp = None
for attempt in range(5):
    try:
        resp = model.generate_content(
            contents=[
                prompt,
                {'mime_type': 'audio/wav', 'data': audio_bytes}
            ],
            generation_config=genai.types.GenerationConfig(temperature=0.0)
        )
        break
    except Exception as e:
        print(f"   [!] Gặp lỗi ({e}), chờ 60 giây để reset hạn ngạch API...", flush=True)
        time.sleep(60)

if resp and resp.text:
    clean_json = resp.text.replace('```json', '').replace('```', '').strip()
    print("\n=== KẾT QUẢ BÓC BĂNG NGUYÊN VĂN ÂM THANH THẬT ===", flush=True)
    print(clean_json, flush=True)

    with open('uploads/exact_subtitles_huyenbe.json', 'w', encoding='utf-8') as f:
        f.write(clean_json)
else:
    print("Không nhận được phản hồi từ Gemini.")

if os.path.exists(wav_path):
    os.remove(wav_path)
