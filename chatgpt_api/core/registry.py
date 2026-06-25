"""Provider registry."""

from __future__ import annotations

from collections.abc import Callable

from chatgpt_api.core.provider import AIProvider

ProviderFactory = Callable[[], AIProvider]


class ProviderRegistry:
    def __init__(self) -> None:
        self._factories: dict[str, ProviderFactory] = {}

    def register(self, name: str, factory: ProviderFactory) -> None:
        normalized = name.strip().lower()
        if not normalized:
            raise ValueError("provider name cannot be empty")
        self._factories[normalized] = factory

    def names(self) -> list[str]:
        return sorted(self._factories)

    def create(self, name: str) -> AIProvider:
        normalized = name.strip().lower()
        try:
            return self._factories[normalized]()
        except KeyError as exc:
            known = ", ".join(self.names()) or "(none)"
            raise KeyError(f"unknown provider {name!r}; known providers: {known}") from exc


default_registry = ProviderRegistry()
