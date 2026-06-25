from chatgpt_api.core.registry import ProviderRegistry
from chatgpt_api.providers.chatgpt.provider import ChatGPTProvider


def test_registry_creates_provider(monkeypatch):
    monkeypatch.delenv("CHATGPT_HAR_PATH", raising=False)
    registry = ProviderRegistry()
    registry.register("chatgpt", ChatGPTProvider.from_env)

    provider = registry.create("chatgpt")

    assert provider.name == "chatgpt"
    assert provider.capabilities.chat is True
    assert provider.capabilities.image_generation is True
