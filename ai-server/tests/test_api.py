import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app, models
from app.contracts import AnalyzeRequest
from app.evaluation import accuracy, evaluate


def sample(task="SINGLE_CHAR", expected="o"):
    import math

    stroke = [
        {
            "x": 450 + 90 * math.cos(t / 24 * math.tau),
            "y": 210 + 100 * math.sin(t / 24 * math.tau),
            "t": 1000 + t,
        }
        for t in range(25)
    ]
    return {
        "task": task,
        "expectedText": expected,
        "source": "TOUCH",
        "width": 900,
        "height": 420,
        "strokes": [stroke],
        "wordEnds": [],
        "modelVersion": "v1",
    }


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_all_real_checkpoints_load_and_predict(self):
        status = self.client.get("/health").json()
        self.assertEqual(status["status"], "UP", status)
        for task, text in [
            ("SINGLE_CHAR", "o"),
            ("COMPOUND", "ch"),
            ("PARAGRAPH", "bé"),
        ]:
            response = self.client.post("/analyze", json=sample(task, text))
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            self.assertIsInstance(result["predictedText"], str)
            self.assertGreaterEqual(result["confidence"], 0)
            self.assertLessEqual(result["confidence"], 1)
            self.assertEqual(result["task"], task)

    def test_expected_answer_does_not_change_recognition(self):
        first = self.client.post("/analyze", json=sample(expected="o")).json()
        second = self.client.post("/analyze", json=sample(expected="z")).json()
        self.assertEqual(first["predictedText"], second["predictedText"])
        self.assertEqual(first["confidence"], second["confidence"])

    def test_preview_has_no_answer_and_never_substitutes_dictionary_text(self):
        payload = sample("PARAGRAPH", "ignored")
        preview = self.client.post("/recognize", json=payload)
        self.assertEqual(preview.status_code, 200, preview.text)
        result = preview.json()
        self.assertIn("suggestedText", result)
        analyzed = self.client.post("/analyze", json=payload).json()
        self.assertEqual(analyzed["predictedText"], result["text"])
        self.assertAlmostEqual(analyzed["confidence"], result["confidence"], places=6)

    def test_adapter_matches_user_demo_recognizers_for_identical_strokes(self):
        import importlib.util
        import numpy as np

        source = Path("D:/Coding/Python/HandWriting/src")
        if not source.exists():
            self.skipTest("Optional external training project is not on this machine")
        for task, file in [
            ("SINGLE_CHAR", "serve.py"),
            ("COMPOUND", "ghep/serve_ghep.py"),
            ("PARAGRAPH", "seq/serve_seq.py"),
        ]:
            # Load the actual file supplied by the user; its src.* dependencies are
            # hash-identical to the checked-in inference snapshot.
            name = (
                "src.ghep.parity_demo"
                if task == "COMPOUND"
                else "src.parity_" + task.lower()
            )
            spec = importlib.util.spec_from_file_location(name, source / file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            reference = module.Recognizer.__new__(module.Recognizer)
            reference.__dict__.update(models.models[task].__dict__)
            for width, height in [
                (420, 420) if task == "SINGLE_CHAR" else (900, 360),
                (300, 300) if task == "SINGLE_CHAR" else (300, 120),
            ]:
                # Distinct non-circular traces and short accent strokes expose scaling/point-loss errors.
                normalized = [
                    [[0.25, 0.7], [0.3, 0.42], [0.43, 0.32], [0.56, 0.4], [0.5, 0.71]],
                    [[0.48, 0.25], [0.5, 0.2], [0.53, 0.24]],
                ]
                raw = [
                    np.array(
                        [[x * width, y * height] for x, y in stroke], dtype=np.float64
                    )
                    for stroke in normalized
                ]
                demo_input = (
                    [
                        [
                            [round(float(x) / width, 4), round(float(y) / height, 4)]
                            for x, y in stroke
                        ]
                        for stroke in raw
                    ]
                    if task == "SINGLE_CHAR"
                    else [s.tolist() for s in raw]
                )
                expected = reference.predict(demo_input)
                actual = models.recognize(task, raw, width, height)
                self.assertEqual(
                    actual["text"],
                    expected["best"] if task == "SINGLE_CHAR" else expected["text"],
                )
                self.assertAlmostEqual(
                    actual["confidence"], expected["confidence"], places=6
                )
                if task == "PARAGRAPH":
                    self.assertEqual(
                        actual["suggestedText"], expected.get("suggested_text", "")
                    )

    def test_validation_and_camera_do_not_invent_strokes(self):
        request = sample()
        request["strokes"][0][0]["x"] = 10000
        self.assertEqual(self.client.post("/analyze", json=request).status_code, 422)
        request = sample()
        request["source"] = "CAMERA"
        self.assertEqual(self.client.post("/analyze", json=request).status_code, 422)
        request = sample()
        request["wordEnds"] = [5]
        self.assertEqual(self.client.post("/analyze", json=request).status_code, 422)

    def test_no_reference_means_no_fake_geometry_scores(self):
        result = self.client.post("/analyze", json=sample()).json()
        self.assertIsNone(result["shapeScore"])
        self.assertIsNone(result["directionScore"])
        self.assertEqual(result["assessmentMethod"], "TEXT_ACCURACY")

    def test_real_model_geometry_and_missing_word_alignment(self):
        request = sample()
        request["template"] = {k: request[k] for k in ["width", "height", "strokes"]}
        result = self.client.post("/analyze", json=request).json()
        self.assertEqual(result["shapeScore"], 100)
        self.assertEqual(result["similarityScore"], 100)
        reversed_request = sample()
        reversed_request["template"] = request["template"]
        reversed_request["strokes"] = [
            [
                {**p, "t": 2000 + i}
                for i, p in enumerate(reversed(reversed_request["strokes"][0]))
            ]
        ]
        reversed_result = self.client.post("/analyze", json=reversed_request).json()
        self.assertEqual(reversed_result["directionScore"], 0)
        request = sample("PARAGRAPH", "bé đi học")
        result = self.client.post("/analyze", json=request).json()
        self.assertTrue(any(not s["predicted"] for s in result["segments"]))

    def test_unavailable_model_fails_closed(self):
        model = models.models.pop("COMPOUND")
        try:
            self.assertEqual(
                self.client.post("/analyze", json=sample("COMPOUND", "ch")).status_code,
                503,
            )
        finally:
            models.models["COMPOUND"] = model

    def test_levenshtein_boundaries(self):
        self.assertEqual(accuracy("bé", "bé"), 1)
        self.assertEqual(accuracy("bé", ""), 0)
        self.assertEqual(accuracy("a", "bbbb"), 0)

    def test_word_exercise_comparison_preserves_prediction_and_ignores_punctuation_case(
        self,
    ):
        # A test-only fixed recognizer isolates the comparison policy from OCR quality.
        class FixedWord:
            def predict(self, task, strokes, width, height):
                return "bé", 0.9

        result = evaluate(AnalyzeRequest(**sample("PARAGRAPH", "Bé.")), FixedWord())
        self.assertEqual(result.predictedText, "bé")
        self.assertEqual(result.textAccuracy, 1)
        self.assertEqual(result.segments[0].score, 100)
        self.assertFalse(any(error.code == "WRONG_TEXT" for error in result.errors))


if __name__ == "__main__":
    unittest.main()
