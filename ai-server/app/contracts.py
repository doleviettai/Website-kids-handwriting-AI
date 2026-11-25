from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Task = Literal["SINGLE_CHAR", "COMPOUND", "PARAGRAPH"]


class Point(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    x: float
    y: float
    t: int | None = None


class Template(BaseModel):
    width: int = Field(ge=1, le=4096)
    height: int = Field(ge=1, le=4096)
    strokes: list[list[Point]] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_points(self):
        if sum(map(len, self.strokes)) > 20000 or any(
            not stroke for stroke in self.strokes
        ):
            raise ValueError("Mẫu nét rỗng hoặc vượt 20.000 điểm.")
        if any(
            not (0 <= p.x <= self.width and 0 <= p.y <= self.height)
            for s in self.strokes
            for p in s
        ):
            raise ValueError("Điểm mẫu ngoài khung vẽ.")
        return self


class AnalyzeRequest(Template):
    task: Task
    expectedText: str = Field(min_length=1, max_length=255)
    source: Literal["TOUCH", "CAMERA"] = "TOUCH"
    modelVersion: str = "v1"
    wordEnds: list[int] = Field(default_factory=list, max_length=100)
    template: Template | None = None

    @model_validator(mode="after")
    def groups(self):
        if self.wordEnds and (
            self.wordEnds != sorted(set(self.wordEnds))
            or self.wordEnds[0] < 1
            or self.wordEnds[-1] != len(self.strokes)
        ):
            raise ValueError("Mốc kết thúc từ phải tăng dần và kết thúc tại số nét.")
        if self.task != "PARAGRAPH" and self.wordEnds:
            raise ValueError("Chỉ bài từ/câu mới dùng mốc tách từ.")
        if self.source == "TOUCH":
            previous = -1
            for stroke in self.strokes:
                for p in stroke:
                    if p.t is None or p.t < previous:
                        raise ValueError("Bài cảm ứng cần thời gian điểm tăng dần.")
                    previous = p.t
        return self


class Finding(BaseModel):
    code: str
    segmentIndex: int | None = None
    strokeIndex: int | None = None


class RecognitionRequest(Template):
    task: Task
    modelVersion: str = "v1"


class Candidate(BaseModel):
    text: str
    confidence: float | None = Field(default=None, ge=0, le=1)


class RecognitionResult(BaseModel):
    text: str
    confidence: float = Field(ge=0, le=1)
    uncertain: bool
    candidates: list[Candidate]
    chars: list[Candidate]
    suggestedText: str
    preview: str | None = None


class Segment(BaseModel):
    index: int
    expected: str
    predicted: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    score: int = Field(ge=0, le=100)
    strokeStart: int | None = None
    strokeEnd: int | None = None


class AnalyzeResult(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    task: Task
    modelVersion: str
    modelPath: str
    predictedText: str = Field(max_length=500)
    confidence: float = Field(ge=0, le=1)
    textAccuracy: float = Field(ge=0, le=1)
    shapeScore: int | None = Field(default=None, ge=0, le=100)
    similarityScore: int | None = Field(default=None, ge=0, le=100)
    directionScore: int | None = Field(default=None, ge=0, le=100)
    strokeOrderScore: int | None = Field(default=None, ge=0, le=100)
    segments: list[Segment] = Field(default_factory=list)
    errors: list[Finding] = Field(default_factory=list)
    assessmentMethod: str
