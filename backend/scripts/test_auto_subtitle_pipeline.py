import importlib.util
import json
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("auto_subtitle_pipeline.py")
SPEC = importlib.util.spec_from_file_location("auto_subtitle_pipeline", SCRIPT_PATH)
PIPELINE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = PIPELINE
SPEC.loader.exec_module(PIPELINE)


class SubtitlePipelineTests(unittest.TestCase):
    def test_extracts_retry_delay_from_google_error(self):
        error = RuntimeError(
            "429 RESOURCE_EXHAUSTED {'retryDelay': '35.224s'} Please retry later"
        )

        self.assertTrue(PIPELINE.is_rate_limit_error(error))
        self.assertAlmostEqual(PIPELINE.provider_retry_delay(error), 35.224)

    def test_parses_all_numbered_segments(self):
        response = json.dumps(
            {
                "segments": [
                    {"index": 11, "en": "Hello", "vi": "Xin chào"},
                    {"index": 12, "en": "Welcome", "vi": "Chào mừng"},
                ]
            },
            ensure_ascii=False,
        )

        parsed = PIPELINE.parse_batch_transcription(response, [11, 12])

        self.assertEqual(parsed[11]["en"], "Hello")
        self.assertEqual(parsed[12]["vi"], "Chào mừng")

    def test_rejects_incomplete_batch_response(self):
        response = json.dumps(
            {"segments": [{"index": 11, "en": "Hello", "vi": "Xin chào"}]}
        )

        with self.assertRaisesRegex(ValueError, "12"):
            PIPELINE.parse_batch_transcription(response, [11, 12])


if __name__ == "__main__":
    unittest.main()
