"""Provider package."""

from chatgpt_api.providers.chatgpt import register as register_chatgpt


def register_builtin_providers() -> None:
    register_chatgpt()
