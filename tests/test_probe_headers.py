from chatgpt_api.cli import (
    _json_headers_for_web_token_refresh,
    _prepare_payload,
    _probe_payload,
    _replay_headers,
    _summarize_sse_payload,
)


def test_replay_headers_drops_transport_owned_headers():
    headers = {
        "authorization": "Bearer fake",
        "content-length": "12",
        "host": "chatgpt.com",
        "accept-encoding": "br",
    }

    replay = _replay_headers(headers)

    assert replay["authorization"] == "Bearer fake"
    assert "content-length" not in replay
    assert "host" not in replay
    assert "accept-encoding" not in replay
    assert replay["accept"] == "text/event-stream"


def test_summarize_sse_payload_extracts_text_without_raw_dump():
    summary = _summarize_sse_payload('{"v":"hello","p":"/message/content/parts/0"}')

    assert "text='hello'" in summary
    assert "keys=p,v" in summary


def test_probe_payload_builds_minimal_chat_body():
    payload = _probe_payload("hello", "auto")

    assert payload["action"] == "next"
    assert payload["model"] == "auto"
    assert payload["messages"][0]["content"]["parts"] == ["hello"]
    assert payload["conversation_mode"] == {"kind": "primary_assistant"}


def test_prepare_payload_keeps_variant_fields_without_messages():
    payload = _prepare_payload(
        {
            "action": "variant",
            "conversation_id": "c1",
            "parent_message_id": "m1",
            "messages": [{"id": "ignored"}],
            "model": "gpt-5-5",
            "variant_purpose": "comparison_implicit",
            "force_parallel_switch": "auto",
        }
    )

    assert payload == {
        "action": "variant",
        "conversation_id": "c1",
        "parent_message_id": "m1",
        "model": "gpt-5-5",
        "variant_purpose": "comparison_implicit",
        "force_parallel_switch": "auto",
    }


def test_refresh_headers_drop_stale_web_tokens():
    headers = {
        "authorization": "Bearer fake",
        "openai-sentinel-chat-requirements-token": "old",
        "x-conduit-token": "old",
        "x-oai-turn-trace-id": "old",
        "accept": "text/event-stream",
    }

    refreshed = _json_headers_for_web_token_refresh(headers)

    assert refreshed["authorization"] == "Bearer fake"
    assert refreshed["accept"] == "application/json"
    assert "openai-sentinel-chat-requirements-token" not in refreshed
    assert "x-conduit-token" not in refreshed
    assert "x-oai-turn-trace-id" not in refreshed
