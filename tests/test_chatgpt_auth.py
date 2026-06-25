import json

from chatgpt_api.providers.chatgpt.auth import ChatGPTAuthConfig


def test_auth_from_env(monkeypatch):
    monkeypatch.delenv("CHATGPT_REQUEST_PATH", raising=False)
    monkeypatch.delenv("CHATGPT_ACCOUNT", raising=False)
    monkeypatch.delenv("CHATGPT_HAR_PATH", raising=False)
    monkeypatch.setenv("CHATGPT_ACCESS_TOKEN", "token-1")
    monkeypatch.setenv("CHATGPT_HEADERS_JSON", '{"User-Agent":"Test"}')
    monkeypatch.setenv("CHATGPT_COOKIES_JSON", '{"oai-did":"did-1"}')

    config = ChatGPTAuthConfig.from_env()

    assert config.access_token == "token-1"
    assert config.headers["user-agent"] == "Test"
    assert config.cookies["oai-did"] == "did-1"
    assert config.request_headers()["authorization"] == "Bearer token-1"


def test_auth_from_env_account(monkeypatch, tmp_path):
    capture_path = tmp_path / "pro" / "chatgpt-request.txt"
    capture_path.parent.mkdir()
    capture_path.write_text(
        """
URL: https://chatgpt.com/backend-api/f/conversation
Authorization: Bearer token-pro
Cookie: oai-did=did-pro
""",
        encoding="utf-8",
    )
    monkeypatch.delenv("CHATGPT_REQUEST_PATH", raising=False)
    monkeypatch.delenv("CHATGPT_HAR_PATH", raising=False)
    monkeypatch.setenv("CHATGPT_ACCOUNT", "pro")
    monkeypatch.setenv("CHATGPT_ACCOUNTS_DIR", str(tmp_path))

    config = ChatGPTAuthConfig.from_env()

    assert config.access_token == "token-pro"
    assert config.cookies["oai-did"] == "did-pro"


def test_auth_from_har_extracts_tokens(tmp_path):
    har_path = tmp_path / "chatgpt.har"
    har_path.write_text(
        json.dumps(
            {
                "log": {
                    "entries": [
                        {
                            "request": {
                                "url": "https://chatgpt.com/backend-api/f/conversation",
                                "headers": [
                                    {"name": "Authorization", "value": "Bearer token-2"},
                                    {"name": "OpenAI-Sentinel-Proof-Token", "value": "proof-1"},
                                ],
                                "cookies": [{"name": "oai-did", "value": "did-2"}],
                            },
                            "response": {"content": {"text": '{"accessToken":"token-3"}'}},
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    config = ChatGPTAuthConfig.from_har(har_path)

    assert config.access_token == "token-3"
    assert config.proof_token == "proof-1"
    assert config.cookies["oai-did"] == "did-2"
