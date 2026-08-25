from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400
    field_errors: dict[str, str] | None = None


def error_payload(error: AppError) -> dict[str, object]:
    body: dict[str, object] = {"code": error.code, "message": error.message}
    if error.field_errors:
        body["field_errors"] = error.field_errors
    return {"error": body}


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_payload(exc))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for item in exc.errors():
            location = ".".join(str(part) for part in item.get("loc", ()) if part != "body")
            if location:
                fields[location] = str(item.get("msg", "Invalid value"))
        error = AppError(
            "VALIDATION_ERROR",
            "The request contains invalid data.",
            422,
            field_errors=fields or None,
        )
        return JSONResponse(status_code=422, content=error_payload(error))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        error = AppError("HTTP_ERROR", "The request could not be completed.", exc.status_code)
        return JSONResponse(status_code=exc.status_code, content=error_payload(error))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_request_error",
            extra={"request_id": getattr(request.state, "request_id", None)},
        )
        error = AppError("INTERNAL_ERROR", "An unexpected error occurred.", 500)
        return JSONResponse(status_code=500, content=error_payload(error))
