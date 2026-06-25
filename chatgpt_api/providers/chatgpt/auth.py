"""Auth configuration for the ChatGPT Web provider."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from chatgpt_api.providers.chatgpt.accounts import resolve_account_capture_path
from chatgpt_api.providers.chatgpt.request_capture import CapturedRequest


def _json_env(name: str) -> dict[str, Any]:
    value = os.environ.get(name, "").strip()
    if not value:
        return {}
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"{name} must be a JSON object")
    return parsed


def _normalize_headers(headers: dict[str, Any]) -> dict[str, str]:
    ignored = {"content-length", "cookie"}
    return {
        str(key).lower(): str(value)
        for key, value in headers.items()
        if str(key).lower() not in ignored and not str(key).startswith(":")
    }


@dataclass(slots=True)
class ChatGPTAuthConfig:
    access_token: str | None = None
    proof_token: str | None = None
    turnstile_token: str | None = None
    cookies: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    captured_url: str | None = None
    captured_request_json: dict[str, Any] | None = None
    source: str | None = None

    @classmethod
    def from_env(cls) -> "ChatGPTAuthConfig":
        request_path = os.environ.get("CHATGPT_REQUEST_PATH", "").strip()
        if request_path:
            path = Path(request_path).expanduser()
            if path.exists():
                return cls.from_captured_request(CapturedRequest.from_file(path))

        account = os.environ.get("CHATGPT_ACCOUNT", "").strip()
        if account:
            path = resolve_account_capture_path(account)
            if path.exists():
                return cls.from_captured_request(CapturedRequest.from_file(path))

        har_path = os.environ.get("CHATGPT_HAR_PATH", "").strip()
        if har_path:
            path = Path(har_path).expanduser()
            if path.exists():
                return cls.from_har(path)

        return cls(
            access_token=os.environ.get("CHATGPT_ACCESS_TOKEN") or None,
            proof_token=os.environ.get("CHATGPT_PROOF_TOKEN") or None,
            turnstile_token=os.environ.get("CHATGPT_TURNSTILE_TOKEN") or None,
            cookies={str(k): str(v) for k, v in _json_env("CHATGPT_COOKIES_JSON").items()},
            headers=_normalize_headers(_json_env("CHATGPT_HEADERS_JSON")),
            source="env",
        )

    @classmethod
    def from_captured_request(cls, capture: CapturedRequest) -> "ChatGPTAuthConfig":
        headers = _normalize_headers(capture.headers)
        access_token = None
        authorization = headers.get("authorization")
        if authorization and " " in authorization:
            access_token = authorization.split(" ", 1)[1]
        elif authorization:
            access_token = authorization

        captured_url = capture.url
        if captured_url and captured_url.endswith("/backend-api/f/conversation/prepare"):
            captured_url = captured_url[: -len("/prepare")]

        return cls(
            access_token=access_token,
            proof_token=headers.get("openai-sentinel-proof-token"),
            turnstile_token=headers.get("openai-sentinel-turnstile-token"),
            cookies={str(k): str(v) for k, v in capture.cookies.items()},
            headers=headers,
            captured_url=captured_url,
            captured_request_json=capture.request_json,
            source=capture.url or "captured-request",
        )

    @classmethod
    def from_har(cls, path: Path) -> "ChatGPTAuthConfig":
        with path.open("r", encoding="utf-8") as file:
            har = json.load(file)

        config = cls(source=str(path))
        entries = har.get("log", {}).get("entries", [])
        if not isinstance(entries, list):
            return config

        for entry in entries:
            request = entry.get("request", {})
            response = entry.get("response", {})
            headers = {
                item.get("name", ""): item.get("value", "")
                for item in request.get("headers", [])
                if isinstance(item, dict)
            }
            normalized = _normalize_headers(headers)
            url = str(request.get("url", ""))

            if "chatgpt.com" in url:
                if normalized:
                    config.headers.update(normalized)
                cookies = request.get("cookies", [])
                if isinstance(cookies, list):
                    config.cookies.update(
                        {
                            str(item.get("name")): str(item.get("value"))
                            for item in cookies
                            if isinstance(item, dict) and item.get("name")
                        }
                    )

            authorization = normalized.get("authorization")
            if authorization and " " in authorization:
                config.access_token = authorization.split(" ", 1)[1]

            proof_token = normalized.get("openai-sentinel-proof-token")
            if proof_token:
                config.proof_token = proof_token

            turnstile_token = normalized.get("openai-sentinel-turnstile-token")
            if turnstile_token:
                config.turnstile_token = turnstile_token

            content_text = response.get("content", {}).get("text", "")
            if isinstance(content_text, str):
                match = re.search(r'"accessToken":"(.+?)"', content_text)
                if match:
                    config.access_token = match.group(1)

        return config

    def request_headers(self) -> dict[str, str]:
        headers = dict(self.headers)
        if self.access_token and "authorization" not in headers:
            headers["authorization"] = f"Bearer {self.access_token}"
        if self.cookies and "cookie" not in headers:
            headers["cookie"] = "; ".join(f"{name}={value}" for name, value in self.cookies.items())
        return headers
