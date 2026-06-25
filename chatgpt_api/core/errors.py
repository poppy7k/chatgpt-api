"""Framework error types."""


class ProviderError(Exception):
    """Base error for provider operations."""


class ProviderNotConfigured(ProviderError):
    """Raised when required auth or provider configuration is missing."""


class ProviderNotReady(ProviderError):
    """Raised when a provider shell exists but its wire protocol is not complete."""


class ProviderFeatureUnsupported(ProviderError):
    """Raised when a provider does not implement a requested capability."""
