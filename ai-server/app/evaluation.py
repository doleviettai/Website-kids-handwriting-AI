"""Reference geometry is a deterministic comparison, not a trained quality-grading model."""

import difflib
import unicodedata
import re
import numpy as np
from PIL import Image, ImageDraw
from .contracts import AnalyzeRequest, AnalyzeResult, Finding, Segment
from .recognition import PATHS


def nfc(text):
    return unicodedata.normalize("NFC", text)


def accuracy(expected, predicted):
    previous = list(range(len(predicted) + 1))
    for i, a in enumerate(expected, 1):
        row = [i]
        for j, b in enumerate(predicted, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = row
    return max(0.0, 1 - previous[-1] / max(len(expected), 1))


def raster(strokes, normalized=False):
    points = np.concatenate(strokes)
    if normalized:
        lo, hi = points.min(0), points.max(0)
        scale = max(float((hi - lo).max()), 0.001)
        strokes = [(s - (lo + hi) / 2) / scale * 0.8 + 0.5 for s in strokes]
    image = Image.new("1", (128, 128))
    pen = ImageDraw.Draw(image)
    for stroke in strokes:
        pts = [tuple(p * 127) for p in stroke]
        if len(pts) == 1:
            x, y = pts[0]
            pen.ellipse((x - 2, y - 2, x + 2, y + 2), fill=1)
        else:
            pen.line(pts, fill=1, width=5)
    return np.asarray(image, dtype=bool)


def overlap(a, b):
    return int(
        round(100 * np.logical_and(a, b).sum() / max(np.logical_or(a, b).sum(), 1))
    )


def evaluate(request: AnalyzeRequest, models):
    if request.source != "TOUCH":
        raise ValueError(
            "Các model hiện tại cần nét viết có thứ tự, chưa hỗ trợ ảnh camera."
        )
    raw = [np.array([[p.x, p.y] for p in s], dtype=np.float64) for s in request.strokes]
    if sum(np.linalg.norm(np.diff(s, axis=0), axis=1).sum() for s in raw) < 3:
        raise ValueError("Bé viết thêm nét trước khi gửi nhé.")
    ends = request.wordEnds or [len(raw)]
    groups, starts, start = [], [], 0
    for end in ends:
        starts.append(start)
        groups.append(raw[start:end])
        start = end
    predictions = [
        models.predict(request.task, group, request.width, request.height)
        for group in groups
    ]
    predicted = nfc(" ".join(text for text, _ in predictions))
    confidence = float(min(p for _, p in predictions))
    expected = nfc(request.expectedText)

    # Match the word demo's exercise comparison: punctuation and case are not
    # handwriting errors. Keep the raw visual text for display and review.
    def words_for_comparison(text):
        return re.sub(r'[.,;:!?"()]', " ", nfc(text)).split()

    comparison_expected = (
        " ".join(words_for_comparison(expected)).casefold()
        if request.task == "PARAGRAPH"
        else expected
    )
    comparison_predicted = (
        " ".join(words_for_comparison(predicted)).casefold()
        if request.task == "PARAGRAPH"
        else predicted
    )
    findings = []
    if comparison_predicted != comparison_expected:
        findings.append(Finding(code="WRONG_TEXT"))
    if confidence < 0.65:
        findings.append(Finding(code="LOW_CONFIDENCE"))
    result = AnalyzeResult(
        task=request.task,
        modelVersion="v1",
        modelPath=PATHS[request.task],
        predictedText=predicted,
        confidence=confidence,
        textAccuracy=accuracy(comparison_expected, comparison_predicted),
        errors=findings,
        assessmentMethod="TEXT_ACCURACY",
    )
    if request.task == "PARAGRAPH":
        exp, pred = words_for_comparison(expected), [nfc(p[0]) for p in predictions]
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(
            a=[w.casefold() for w in exp],
            b=[" ".join(words_for_comparison(w)).casefold() for w in pred],
            autojunk=False,
        ).get_opcodes():
            for offset in range(max(i2 - i1, j2 - j1)):
                i, j = i1 + offset, j1 + offset
                reference = exp[i] if i < i2 else ""
                hypothesis = pred[j] if j < j2 else ""
                index = len(result.segments)
                if index >= 100:
                    raise ValueError("Bài quá dài; tối đa 100 từ mỗi lượt.")
                result.segments.append(
                    Segment(
                        index=index,
                        expected=reference,
                        predicted=hypothesis,
                        confidence=predictions[j][1] if j < j2 else None,
                        score=round(
                            100
                            * accuracy(
                                reference.casefold(),
                                " ".join(words_for_comparison(hypothesis)).casefold(),
                            )
                        ),
                        strokeStart=starts[j] if j < j2 else None,
                        strokeEnd=ends[j] if j < j2 else None,
                    )
                )
                if (
                    reference.casefold()
                    != " ".join(words_for_comparison(hypothesis)).casefold()
                ):
                    result.errors.append(Finding(code="WRONG_TEXT", segmentIndex=index))
        return result
    if request.template:
        student = [s / np.array([request.width, request.height]) for s in raw]
        template = [
            np.array(
                [
                    [p.x / request.template.width, p.y / request.template.height]
                    for p in s
                ]
            )
            for s in request.template.strokes
        ]
        result.shapeScore = overlap(raster(student, True), raster(template, True))
        result.similarityScore = overlap(raster(student), raster(template))
        result.assessmentMethod = "REFERENCE_GEOMETRY"
        if len(student) < len(template):
            result.errors.append(Finding(code="MISSING_STROKES"))
        if len(student) > len(template):
            result.errors.append(Finding(code="EXTRA_STROKES"))
        if len(student) == len(template):
            costs = np.array(
                [
                    [np.linalg.norm(a.mean(0) - b.mean(0)) for b in template]
                    for a in student
                ]
            )
            nearest = costs.argmin(1)
            if (
                len(set(nearest.tolist())) == len(template)
                and costs.min(1).max() < 0.12
            ):
                result.strokeOrderScore = round(
                    100 * float((nearest == np.arange(len(template))).mean())
                )
                direction = []
                for a, index in zip(student, nearest):
                    from src.stroke_utils import resample_stroke

                    b = template[index]
                    if len(a) < 2 or len(b) < 2:
                        continue
                    aa, bb = resample_stroke(a, 32), resample_stroke(b, 32)
                    direct = np.linalg.norm(aa - bb, axis=1).mean()
                    reverse = np.linalg.norm(aa - bb[::-1], axis=1).mean()
                    if abs(direct - reverse) > 0.01:
                        direction.append(100 if direct < reverse else 0)
                result.directionScore = (
                    round(float(np.mean(direction))) if direction else None
                )
                if result.strokeOrderScore < 100:
                    result.errors.append(Finding(code="STROKE_ORDER_WRONG"))
                if result.directionScore is not None and result.directionScore < 100:
                    result.errors.append(Finding(code="WRONG_DIRECTION"))
    return result
