from __future__ import annotations


class ModelProviderError(Exception):
    def __init__(self, code: str, public_message: str, *, diagnostics: dict[str, object] | None = None) -> None:
        super().__init__(public_message)
        self.code = code
        self.public_message = public_message
        self.diagnostics = diagnostics


_REASONING_PARAMETERS = ("reasoning_effort", "reasoning.effort")
_PROFILE_PARAMETERS = ("temperature", "max_tokens", "max_completion_tokens")


def unsupported_parameter_message(status: object, parameter: object, message: object) -> str | None:
    """A user-facing message when the provider rejected one of our generation options."""
    if status not in {400, 422}:
        return None
    parameter = str(parameter or "").lower()
    message = str(message or "").lower()
    if parameter in _REASONING_PARAMETERS or any(name in message for name in _REASONING_PARAMETERS):
        return "The model does not accept this reasoning effort. Choose another effort or Model default."
    if parameter in _PROFILE_PARAMETERS:
        return f"The provider rejected the {parameter} setting. Update the model profile settings."
    return None
