from __future__ import annotations


class ModelProviderError(Exception):
    def __init__(self, code: str, public_message: str, *, diagnostics: dict[str, object] | None = None) -> None:
        super().__init__(public_message)
        self.code = code
        self.public_message = public_message
        self.diagnostics = diagnostics
