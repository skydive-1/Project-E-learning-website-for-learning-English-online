#!/usr/bin/env python3
"""Generate bilingual subtitle cues from waveform-derived speech intervals.

The script deliberately uses Gemini only for transcription and translation. Cue
timestamps always come from pydub.silence.detect_nonsilent(), never from the AI
response.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydub import AudioSegment
from pydub.silence import detect_nonsilent


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


DEFAULT_MODEL = "gemini-3.7-flash"
TRANSCRIPTION_PROMPT = """
Listen to this English speech segment carefully. Return only one valid JSON
object with exactly these string fields:
{
  "en": "An exact English transcription of every spoken word",
  "vi": "A natural and pedagogically accurate Vietnamese translation"
}

Do not summarize, omit, correct, or invent speech. Do not include timestamps,
speaker labels, Markdown, or any fields other than en and vi. If there is no
intelligible speech, return empty strings for both fields.
""".strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create bilingual subtitle cues using silence detection and Gemini."
    )
    parser.add_argument("video_path", help="Local video or audio file to process")
    parser.add_argument(
        "--min_silence",
        type=int,
        default=400,
        help="Minimum silence duration in milliseconds (default: 400)",
    )
    parser.add_argument(
        "--silence_thresh",
        type=float,
        default=-40.0,
        help="Silence threshold in dBFS (default: -40)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=2,
        help="Maximum concurrent Gemini requests (default: 2)",
    )
    parser.add_argument("--output", required=True, help="Destination JSON file")
    return parser.parse_args()


def format_timestamp(milliseconds: int) -> str:
    hours, remainder = divmod(max(0, milliseconds), 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def resolve_ffmpeg_path() -> str:
    configured = os.getenv("FFMPEG_PATH")
    if configured:
        configured_path = Path(configured).expanduser()
        if configured_path.is_file():
            return str(configured_path.resolve())
        raise RuntimeError(f"FFMPEG_PATH không trỏ tới file hợp lệ: {configured_path}")

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    backend_root = Path(__file__).resolve().parents[1]
    installer_root = backend_root / "node_modules" / "@ffmpeg-installer"
    packaged_candidates = sorted(installer_root.glob("*/ffmpeg.exe"))
    packaged_candidates.extend(sorted(installer_root.glob("*/ffmpeg")))
    for candidate in packaged_candidates:
        if candidate.is_file():
            return str(candidate.resolve())

    raise RuntimeError(
        "Không tìm thấy ffmpeg. Hãy cài ffmpeg, cài dependency backend "
        "@ffmpeg-installer/ffmpeg, hoặc đặt biến FFMPEG_PATH."
    )


def extract_audio(source_path: Path, audio_path: Path) -> None:
    ffmpeg = resolve_ffmpeg_path()
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(audio_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Không tìm thấy ffmpeg tại '{ffmpeg}'.") from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or str(exc)).strip()
        raise RuntimeError(f"FFmpeg không thể trích xuất audio: {details}") from exc


def parse_json_object(raw_text: str) -> dict[str, Any]:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        object_match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not object_match:
            raise
        parsed = json.loads(object_match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response is not a JSON object")
    return parsed


def configured_models() -> list[str]:
    preferred = (
        os.getenv("GEMINI_SUBTITLE_MODEL")
        or os.getenv("GEMINI_MODEL")
        or DEFAULT_MODEL
    )
    fallbacks = [
        item.strip()
        for item in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash").split(",")
        if item.strip()
    ]
    return list(dict.fromkeys([preferred, *fallbacks]))


def transcribe_segment(segment_path: Path, segment_number: int) -> dict[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Thiếu biến môi trường GEMINI_API_KEY")

    audio_bytes = segment_path.read_bytes()
    last_error: Exception | None = None

    for model in configured_models():
        for attempt in range(1, 4):
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model,
                    contents=[
                        TRANSCRIPTION_PROMPT,
                        types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"),
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0,
                    ),
                )
                parsed = parse_json_object(response.text or "")
                return {
                    "en": str(parsed.get("en") or "").strip(),
                    "vi": str(parsed.get("vi") or "").strip(),
                }
            except Exception as exc:  # SDK raises multiple transport/API error types.
                last_error = exc
                if attempt < 3:
                    time.sleep(2 ** (attempt - 1))
        print(
            f"[Cảnh báo] Đoạn {segment_number}: model {model} thất bại, thử model kế tiếp.",
            file=sys.stderr,
        )

    raise RuntimeError(
        f"Gemini không thể xử lý đoạn {segment_number}: {last_error}"
    ) from last_error


def detect_speech_intervals(
    audio: AudioSegment, min_silence: int, silence_thresh: float
) -> list[tuple[int, int]]:
    intervals = detect_nonsilent(
        audio,
        min_silence_len=min_silence,
        silence_thresh=silence_thresh,
        seek_step=1,
    )
    return [(int(start), int(end)) for start, end in intervals if end > start]


def build_cues(
    audio: AudioSegment,
    intervals: list[tuple[int, int]],
    work_dir: Path,
    workers: int,
) -> list[dict[str, Any]]:
    segment_paths: list[Path] = []
    for index, (start_ms, end_ms) in enumerate(intervals, start=1):
        segment_path = work_dir / f"speech_{index:05d}.wav"
        audio[start_ms:end_ms].export(segment_path, format="wav")
        segment_paths.append(segment_path)

    transcripts: dict[int, dict[str, str]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(transcribe_segment, path, index): index
            for index, path in enumerate(segment_paths, start=1)
        }
        completed = 0
        for future in as_completed(futures):
            index = futures[future]
            transcripts[index] = future.result()
            completed += 1
            print(f"[Tiến độ] {completed}/{len(intervals)} đoạn đã được bóc băng.")

    cues: list[dict[str, Any]] = []
    for index, (start_ms, end_ms) in enumerate(intervals, start=1):
        transcript = transcripts[index]
        if not transcript["en"] and not transcript["vi"]:
            continue
        cues.append(
            {
                "id": len(cues) + 1,
                "start": round(start_ms / 1000.0, 3),
                "end": round(end_ms / 1000.0, 3),
                "startFormatted": format_timestamp(start_ms),
                "endFormatted": format_timestamp(end_ms),
                "en": transcript["en"],
                "vi": transcript["vi"],
            }
        )
    return cues


def write_output(output_path: Path, payload: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    os.replace(temporary_path, output_path)


def main() -> int:
    args = parse_args()
    if args.min_silence <= 0:
        raise ValueError("--min_silence phải lớn hơn 0")
    if args.workers <= 0:
        raise ValueError("--workers phải lớn hơn 0")

    source_path = Path(args.video_path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file đầu vào: {source_path}")

    load_dotenv()
    print("[Tiến độ] Đang trích xuất audio mono 16 kHz bằng FFmpeg...")
    with tempfile.TemporaryDirectory(prefix="elearn_subtitle_vad_") as temp_dir:
        work_dir = Path(temp_dir)
        audio_path = work_dir / "audio_16khz_mono.wav"
        extract_audio(source_path, audio_path)

        audio = AudioSegment.from_wav(audio_path)
        intervals = detect_speech_intervals(
            audio, args.min_silence, args.silence_thresh
        )
        print(f"🧩 Phát hiện {len(intervals)} đoạn có tiếng nói từ waveform thật.")

        if not intervals:
            write_output(
                output_path,
                {
                    "cues": [],
                    "metadata": {
                        "durationMs": len(audio),
                        "speechSegments": 0,
                        "minSilenceMs": args.min_silence,
                        "silenceThresholdDbfs": args.silence_thresh,
                    },
                },
            )
            print("✅ Không phát hiện lời nói; đã ghi kết quả cues rỗng.")
            return 0

        cues = build_cues(audio, intervals, work_dir, args.workers)
        write_output(
            output_path,
            {
                "cues": cues,
                "metadata": {
                    "durationMs": len(audio),
                    "speechSegments": len(intervals),
                    "minSilenceMs": args.min_silence,
                    "silenceThresholdDbfs": args.silence_thresh,
                    "timestampsSource": "pydub.detect_nonsilent",
                },
            },
        )
        print(f"✅ Đã ghi {len(cues)} cues vào {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Đã hủy pipeline.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"[Lỗi VAD Pipeline] {error}", file=sys.stderr)
        raise SystemExit(1)
