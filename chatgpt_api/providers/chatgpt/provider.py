"""ChatGPT provider implementation."""

from __future__ import annotations

from collections.abc import AsyncIterator

from chatgpt_api.core.provider import AIProvider
from chatgpt_api.core.types import ChatDelta, ChatRequest, ImageRequest, ImageResponse, ProviderCapabilities
from chatgpt_api.providers.chatgpt.auth import ChatGPTAuthConfig
from chatgpt_api.providers.chatgpt.transport import ChatGPTWebTransport


class ChatGPTProvider(AIProvider):
    name = "chatgpt"
    capabilities = ProviderCapabilities(
        chat=True,
        streaming=True,
        image_generation=True,
        image_edit=True,
        vision=True,
    )

    def __init__(self, transport: ChatGPTWebTransport) -> None:
        self.transport = transport

    @classmethod
    def from_env(cls) -> "ChatGPTProvider":
        auth = ChatGPTAuthConfig.from_env()
        return cls(ChatGPTWebTransport(auth))

    async def stream_chat(self, request: ChatRequest) -> AsyncIterator[ChatDelta]:
        async for delta in self.transport.stream_chat(request):
            yield delta

    async def generate_image(self, request: ImageRequest) -> ImageResponse:
        return await self.transport.generate_image(request)
