import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "vendor/handwriting"))
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.contracts import (
    AnalyzeRequest,
    AnalyzeResult,
    RecognitionRequest,
    RecognitionResult,
)
from app.recognition import Recognizers
from app.evaluation import evaluate

models = Recognizers()


@asynccontextmanager
async def lifespan(app):
    try:
        models.load()
    except Exception as exc:
        models.problems.update(
            {
                task: f"{type(exc).__name__}: {exc}"
                for task in ("SINGLE_CHAR", "COMPOUND", "PARAGRAPH")
            }
        )
    yield


app = FastAPI(title="NétXinh Handwriting AI", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    total, chunks = 0, []
    async for chunk in request.stream():
        total += len(chunk)
        if total > 3_000_000:
            return JSONResponse(
                status_code=413,
                content={"message": "Bài viết vượt giới hạn dung lượng."},
            )
        chunks.append(chunk)
    request._body = b"".join(chunks)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    return JSONResponse(
        status_code=422,
        content={
            "message": "Dữ liệu nét viết chưa hợp lệ. Kiểm tra khung vẽ, thời gian và mốc tách từ."
        },
    )


@app.get("/health")
def health():
    return {
        "status": "UP" if len(models.models) == 3 else "DEGRADED",
        "models": models.status(),
        "cameraSupported": False,
        "paragraphMode": "WORD_BY_WORD",
    }


@app.post("/recognize", response_model=RecognitionResult)
def recognize(request: RecognitionRequest):
    if request.modelVersion != "v1":
        raise HTTPException(409, "Phiên bản model chưa được nạp.")
    if request.task not in models.models:
        raise HTTPException(503, "Model chưa sẵn sàng.")
    try:
        import numpy as np

        strokes = [
            np.array([[p.x, p.y] for p in stroke], dtype=np.float64)
            for stroke in request.strokes
        ]
        return models.recognize(request.task, strokes, request.width, request.height)
    except ValueError as exc:
        raise HTTPException(
            422, "Nét chưa phù hợp, bé viết rõ một chữ hoặc một từ rồi thử lại nhé."
        ) from exc
    except Exception as exc:
        raise HTTPException(503, "Chưa nhận dạng được. Kiểm tra dịch vụ AI.") from exc


@app.post("/analyze", response_model=AnalyzeResult)
def analyze(request: AnalyzeRequest):
    if request.modelVersion != "v1":
        raise HTTPException(409, "Phiên bản model chưa được nạp.")
    if request.task not in models.models:
        raise HTTPException(
            503, "Model chưa sẵn sàng. Kiểm tra /health và cấu hình huấn luyện."
        )
    try:
        return evaluate(request, models)
    except ValueError as exc:
        raise HTTPException(
            422,
            "Nét viết không phù hợp với model; bé chia theo từng từ và thử lại nhé.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            503,
            "Model chưa xử lý được bài viết. Vui lòng thử lại hoặc kiểm tra log dịch vụ.",
        ) from exc
