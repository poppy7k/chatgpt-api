"""Provider contract used by every backend."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from chatgpt_api.core.errors import ProviderFeatureUnsupported
from chatgpt_api.core.types import (
    ChatDelta,
    ChatRequest,
    ChatResponse,
    ImageRequest,
    ImageResponse,
    ProviderCapabilities,
)


class AIProvider(ABC):
    """Base class for provider implementations."""

    name: str
    capabilities = ProviderCapabilities()

    @abstractmethod
    async def stream_chat(self, request: ChatRequest) -> AsyncIterator[ChatDelta]:
        """Stream a chat response."""

    async def chat(self, request: ChatRequest) -> ChatResponse:
        text_parts: list[str] = []
        conversation_id = request.conversation_id
        raw = None
        async for delta in self.stream_chat(request):
            if delta.text:
                text_parts.append(delta.text)
            if delta.conversation_id:
                conversation_id = delta.conversation_id
            if delta.raw is not None:
                raw = delta.raw
        return ChatResponse(text="".join(text_parts), conversation_id=conversation_id, raw=raw)

    async def generate_image(self, request: ImageRequest) -> ImageResponse:
        raise ProviderFeatureUnsupported(f"{self.name} does not implement image generation")
