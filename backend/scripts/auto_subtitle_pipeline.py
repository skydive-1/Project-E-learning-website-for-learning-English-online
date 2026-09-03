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
import random
import re
import shutil
import subprocess
import sys
import tempfile
import threading
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
DEFAULT_BATCH_SIZE = 12
DEFAULT_REQUESTS_PER_MINUTE = 4
DEFAULT_MAX_RETRIES = 5


class RequestRateLimiter:
    """Thread-safe fixed-interval limiter shared by every batch in this process."""

    def __init__(self, requests_per_minute: int) -> None:
        if requests_per_minute <= 0:
            raise ValueError("requests_per_minute must be greater than zero")
        self.minimum_interval = 60.0 / requests_per_minute
        self.next_request_at = 0.0
        self.lock = threading.Lock()

    def wait_for_slot(self) -> None:
        with self.lock:
            now = time.monotonic()
            wait_seconds = max(0.0, self.next_request_at - now)
            reserved_at = max(now, self.next_request_at)
            self.next_request_at = reserved_at + self.minimum_interval
        if wait_seconds > 0:
            time.sleep(wait_seconds)

    def defer_for(self, seconds: float) -> None:
        """Pause future requests too when the provider sends a Retry-After hint."""
        with self.lock:
            self.next_request_at = max(
                self.next_request_at,
                time.monotonic() + max(0.0, seconds),
            )


def positive_env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} phải là số nguyên dương") from exc
    if parsed <= 0:
        raise ValueError(f"{name} phải là số nguyên dương")
    return parsed


def batch_transcription_prompt(segment_numbers: list[int]) -> str:
    return f"""
You will receive {len(segment_numbers)} separate English speech audio parts.
The text immediately before each audio part gives its segment number.

Return only one valid JSON object in this exact shape:
{{
  "segments": [
    {{"index": {segment_numbers[0]}, "en": "exact English transcript", "vi": "natural Vietnamese translation"}}
  ]
}}

Return exactly one item for every segment number in this list, in the same
order: {segment_numbers}. Do not summarize, omit, correct, merge, or invent
speech. Do not include timestamps, speaker labels, Markdown, or extra fields.
If an audio part has no intelligible speech, return empty strings for that item.
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
        default=positive_env_int("SUBTITLE_VAD_WORKERS", 1),
        help="Maximum concurrent Gemini batch requests (default: 1)",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=positive_env_int("SUBTITLE_VAD_BATCH_SIZE", DEFAULT_BATCH_SIZE),
        help=f"Speech segments sent in one Gemini request (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--requests_per_minute",
        type=int,
        default=positive_env_int(
            "SUBTITLE_GEMINI_REQUESTS_PER_MINUTE",
            DEFAULT_REQUESTS_PER_MINUTE,
        ),
        help=(
            "Maximum Gemini requests per minute for each model "
            f"(default: {DEFAULT_REQUESTS_PER_MINUTE})"
        ),
    )
    parser.add_argument(
        "--max_retries",
        type=int,
        default=positive_env_int("SUBTITLE_GEMINI_MAX_RETRIES", DEFAULT_MAX_RETRIES),
        help=f"Maximum attempts per model and batch (default: {DEFAULT_MAX_RETRIES})",
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
        for item in os.getenv(
            "GEMINI_FALLBACK_MODELS",
            "gemini-3.6-flash,gemini-3.5-flash-lite",
        ).split(",")
        if item.strip()
    ]
    return list(dict.fromkeys([preferred, *fallbacks]))


def is_rate_limit_error(error: Exception) -> bool:
    message = str(error).lower()
    status_code = getattr(error, "status_code", None) or getattr(error, "code", None)
    return (
        status_code == 429
        or "429" in message
        or "resource_exhausted" in message
        or "rate limit" in message
        or "quota" in message
    )


def provider_retry_delay(error: Exception) -> float | None:
    response = getattr(error, "response", None)
    headers = getattr(response, "headers", None)
    if headers:
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except (TypeError, ValueError):
                pass

    message = str(error)
    patterns = (
        r"retryDelay.{0,16}?([0-9]+(?:\.[0-9]+)?)s",
        r"retry in\s+([0-9]+(?:\.[0-9]+)?)s",
        r"retry-after.{0,8}?([0-9]+(?:\.[0-9]+)?)",
    )
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            return max(0.0, float(match.group(1)))
    return None


def parse_batch_transcription(
    raw_text: str, expected_segment_numbers: list[int]
) -> dict[int, dict[str, str]]:
    parsed = parse_json_object(raw_text)
    raw_segments = parsed.get("segments")
    if not isinstance(raw_segments, list):
        raise ValueError("Gemini response does not contain a segments array")

    expected = set(expected_segment_numbers)
    transcripts: dict[int, dict[str, str]] = {}
    for item in raw_segments:
        if not isinstance(item, dict):
            continue
        try:
            index = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        if index not in expected or index in transcripts:
            continue
        transcripts[index] = {
            "en": str(item.get("en") or "").strip(),
            "vi": str(item.get("vi") or "").strip(),
        }

    missing = [index for index in expected_segment_numbers if index not in transcripts]
    if missing:
        raise ValueError(f"Gemini response thiếu các đoạn: {missing}")
    return transcripts


def transcribe_batch(
    segments: list[tuple[int, Path]],
    batch_number: int,
    rate_limiters: dict[str, RequestRateLimiter],
    max_retries: int,
) -> dict[int, dict[str, str]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Thiếu biến môi trường GEMINI_API_KEY")

    segment_numbers = [number for number, _ in segments]
    contents: list[Any] = [batch_transcription_prompt(segment_numbers)]
    for segment_number, segment_path in segments:
        contents.append(f"Segment {segment_number} audio:")
        contents.append(
            types.Part.from_bytes(data=segment_path.read_bytes(), mime_type="audio/wav")
        )

    last_error: Exception | None = None
    models = configured_models()

    for model_index, model in enumerate(models):
        for attempt in range(1, max_retries + 1):
            try:
                rate_limiters[model].wait_for_slot()
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0,
                    ),
                )
                return parse_batch_transcription(response.text or "", segment_numbers)
            except Exception as exc:  # SDK raises multiple transport/API error types.
                last_error = exc
                if attempt >= max_retries:
                    break

                if is_rate_limit_error(exc):
                    requested_delay = provider_retry_delay(exc)
                    retry_seconds = max(
                        requested_delay or 0.0,
                        min(60.0, float(2 ** attempt)),
                    ) + random.uniform(0.25, 1.0)
                    print(
                        f"[Giới hạn Gemini] Lô {batch_number}, model {model}: "
                        f"chờ {retry_seconds:.1f}s trước lần thử {attempt + 1}/{max_retries}.",
                        file=sys.stderr,
                    )
                    rate_limiters[model].defer_for(retry_seconds)
                    time.sleep(retry_seconds)
                else:
                    retry_seconds = min(30.0, float(2 ** (attempt - 1)))
                    print(
                        f"[Cảnh báo] Lô {batch_number}, model {model}: "
                        f"thử lại sau {retry_seconds:.1f}s ({attempt + 1}/{max_retries}).",
                        file=sys.stderr,
                    )
                    time.sleep(retry_seconds)

        if model_index < len(models) - 1:
            print(
                f"[Cảnh báo] Lô {batch_number}: model {model} vẫn thất bại "
                "sau khi retry, chuyển model kế tiếp.",
                file=sys.stderr,
            )

    raise RuntimeError(
        f"Gemini không thể xử lý lô {batch_number} (đoạn {segment_numbers}): {last_error}"
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
    batch_size: int,
    requests_per_minute: int,
    max_retries: int,
) -> list[dict[str, Any]]:
    segment_paths: list[Path] = []
    for index, (start_ms, end_ms) in enumerate(intervals, start=1):
        segment_path = work_dir / f"speech_{index:05d}.wav"
        audio[start_ms:end_ms].export(segment_path, format="wav")
        segment_paths.append(segment_path)

    numbered_paths = list(enumerate(segment_paths, start=1))
    batches = [
        numbered_paths[offset : offset + batch_size]
        for offset in range(0, len(numbered_paths), batch_size)
    ]
    rate_limiters = {
        model: RequestRateLimiter(requests_per_minute)
        for model in configured_models()
    }

    print(
        f"[Tiến độ] Đã gom {len(intervals)} đoạn thành {len(batches)} lô; "
        f"tối đa {requests_per_minute} request/phút/model."
    )

    transcripts: dict[int, dict[str, str]] = {}
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = {
            executor.submit(
                transcribe_batch,
                batch,
                batch_number,
                rate_limiters,
                max_retries,
            ): batch_number
            for batch_number, batch in enumerate(batches, start=1)
        }
        completed_segments = 0
        for future in as_completed(futures):
            batch_transcripts = future.result()
            transcripts.update(batch_transcripts)
            completed_segments += len(batch_transcripts)
            print(
                f"[Tiến độ] {completed_segments}/{len(intervals)} đoạn đã được bóc băng."
            )

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
    load_dotenv()
    args = parse_args()
    if args.min_silence <= 0:
        raise ValueError("--min_silence phải lớn hơn 0")
    if args.workers <= 0:
        raise ValueError("--workers phải lớn hơn 0")
    if args.batch_size <= 0:
        raise ValueError("--batch_size phải lớn hơn 0")
    if args.requests_per_minute <= 0:
        raise ValueError("--requests_per_minute phải lớn hơn 0")
    if args.max_retries <= 0:
        raise ValueError("--max_retries phải lớn hơn 0")

    source_path = Path(args.video_path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file đầu vào: {source_path}")

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

        cues = build_cues(
            audio,
            intervals,
            work_dir,
            args.workers,
            args.batch_size,
            args.requests_per_minute,
            args.max_retries,
        )
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
