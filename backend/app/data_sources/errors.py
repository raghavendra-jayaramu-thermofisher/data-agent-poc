from __future__ import annotations


class DataSourceOperationError(Exception):
    def __init__(self, code: str, public_message: str, *, retryable: bool = False, diagnostics: dict[str, object] | None = None) -> None:
        self.code = code
        self.public_message = public_message
        self.retryable = retryable
        self.diagnostics = diagnostics
        super().__init__(public_message)


class DataSourceConfigurationError(DataSourceOperationError):
    pass
