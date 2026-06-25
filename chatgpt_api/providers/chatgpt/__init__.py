"""ChatGPT Web provider."""

from chatgpt_api.core.registry import default_registry
from chatgpt_api.providers.chatgpt.provider import ChatGPTProvider


def register() -> None:
    default_registry.register("chatgpt", ChatGPTProvider.from_env)


__all__ = ["ChatGPTProvider", "register"]
