# OpenAI-Shaped API

The local server exposes an OpenAI-shaped API backed by a selected ChatGPT Web
account.

This is not only for opencode. Any client that can send OpenAI-shaped JSON can
point its `baseURL` at the local server to test request/response behavior before
moving to a stricter production provider.

## Local Test Endpoint

```sh
CHATGPT_API_KEY=local-dev-key chatgpt-api serve --account free-main --port 8000
```

```text
baseURL = http://127.0.0.1:8000/v1
apiKey  = local-dev-key
model   = auto
```

Use `model = auto` when you want ChatGPT Web to choose the model like the web UI
does. Use explicit models such as `gpt-5-5` when you want model limit or
availability failures to surface clearly instead of being hidden by web-side
fallback behavior.

## Later Official OpenAI Endpoint

```text
baseURL = https://api.openai.com/v1
apiKey  = sk-...
model   = a real OpenAI API model
```

The intended migration is small: change `baseURL`, API key, and model name.

## Supported Routes

```text
GET  /health
GET  /v1/models
GET  /v1/chatgpt/usage
POST /v1/chat/completions
POST /v1/images/generations
POST /v1/images/edits
POST /v1/chatgpt/vision
GET  /v1/chatgpt/files/{file_id}/{filename}
POST /v1/chatgpt/operations/{operation_id}/cancel
```

Supported response shapes:

- non-streaming `chat.completion`
- streaming `chat.completion.chunk` SSE
- assistant `tool_calls`
- image generation responses with local `url`, `path`, or `b64_json`
- image edit/composite responses with one saved output image
- vision/OCR responses with text in `text` and `choices[0].message.content`
- Deep Research responses with a saved markdown report path and download URL

## Model Aliases

`GET /v1/models` is the source of truth for the current server route. It merges
the capabilities inferred from the configured ChatGPT account captures.

Representative aliases:

```text
auto
gpt-5-5
gpt-5-5-thinking-standard
gpt-5-5-thinking-extended
gpt-5-5-thinking-max
gpt-5-5-pro-standard
gpt-5-5-pro-extended
auto@optimized
auto@opencode
gpt-5-5@optimized
gpt-5-5@opencode
gpt-image-1
chatgpt-deep-research
```

Rules:

- `auto` is the safest default and should be used for Free/Go accounts.
- `gpt-5-5*`, `gpt-5-5-thinking-*`, and `gpt-5-5-pro-*` require account support.
- `@optimized` and `@opencode` are agent prompt bridge suffixes for tool-calling
  clients such as opencode.
- `gpt-image-1` is for `POST /v1/images/generations` only.
- `chatgpt-deep-research` is for Deep Research through
  `POST /v1/chat/completions`.
- Legacy aliases such as `chatgpt-web/deep-research` are accepted, but new docs
  should use `chatgpt-deep-research`.

## Capacity And Usage

`GET /v1/chatgpt/usage` returns live per-account ChatGPT Web limits when the web
API reports them. The bridge also has local concurrency limits:

```text
recommended chat:     free=1, go=2, plus=3, pro=4
recommended upload:   free=1, go=1, plus=1, pro=1
recommended images:   free=1, go=1, plus=2, pro=3
recommended research: free=1, go=1, plus=2, pro=2
```

`upload` is the local bucket used by input-image calls: OCR, image description,
image edits, and multi-image composites. A single request can upload up to 10
images. The bridge preflights `file_upload` quota when ChatGPT reports it, but
ChatGPT can still apply hidden short burst limits.

For example, two Pro accounts with the recommended image limit can run up to six
image jobs locally, but ChatGPT may still apply hidden burst rate limits. A Pro
plan can show a high daily image quota while still throttling rapid bursts for a
few minutes.

Usage response shape:

```json
{
  "object": "chatgpt.usage",
  "accounts": [
    {
      "account": "pro-main",
      "ok": true,
      "plan_bucket": "pro",
      "default_model_slug": "gpt-5-5",
      "features": {
        "file_upload": {
          "remaining": 23,
          "reset_after": "2026-06-25T00:37:00Z"
        },
        "image_gen": {
          "remaining": 938,
          "reset_after": "2026-06-25T00:37:00Z"
        },
        "deep_research": {
          "remaining": 224,
          "reset_after": "2026-07-24T00:37:54Z"
        }
      }
    }
  ]
}
```

## Chat Completions

Non-streaming chat:

```sh
curl 'http://127.0.0.1:8000/v1/chat/completions' \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Reply with exactly: bridge ok"}
    ],
    "stream": false
  }'
```

Response:

```json
{
  "id": "chatcmpl_local",
  "object": "chat.completion",
  "created": 1782320100,
  "model": "auto",
  "chatgpt_account": "free-main",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "bridge ok"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

Streaming chat uses the same route with `"stream": true` and returns SSE
`chat.completion.chunk` events:

```text
data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"bridge"}}]}
data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":" ok"}}]}
data: {"object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop"}]}
data: [DONE]
```

Tool calling uses the same route. The bridge asks ChatGPT to emit strict JSON,
validates the requested tool names, and returns OpenAI-style `tool_calls` for
the client to execute. The server never executes tools itself.

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_local_1",
            "type": "function",
            "function": {
              "name": "write_file",
              "arguments": "{\"path\":\"notes.txt\",\"content\":\"hello\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

## Image Generation

`POST /v1/images/generations` asks ChatGPT image generation to create a new
image and saves the completed asset.

```sh
curl 'http://127.0.0.1:8000/v1/images/generations' \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A clean blue glass app icon, no text",
    "n": 1
  }'
```

`n` is fixed to one output in this bridge. If a client asks for more, the route
still returns one completed image because ChatGPT Web image generation produces
a single visible asset per request in this flow.

Response:

```json
{
  "created": 1782320100,
  "chatgpt_account": "pro-main",
  "chatgpt_operation_id": "chatgptop_abc",
  "data": [
    {
      "url": "http://127.0.0.1:8000/v1/chatgpt/files/file_icon/icon.png",
      "download_url": "http://127.0.0.1:8000/v1/chatgpt/files/file_icon/icon.png",
      "path": "/Users/work/Desktop/chatgpt-api/outputs/chatgpt-images/icon.png",
      "filename": "icon.png",
      "content_type": "image/png"
    }
  ]
}
```

Use `download_url` from browsers and LAN devices. Use `path` only when the
client runs on the same filesystem as the API server.

## Vision, OCR, And Image Inputs

`POST /v1/chatgpt/vision` is the bridge-specific route for OCR and image
understanding. It returns text only.

```sh
curl 'http://127.0.0.1:8000/v1/chatgpt/vision' \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "ocr",
    "image": "./favicon.png",
    "prompt": "Extract the visible text only."
  }'
```

Response:

```json
{
  "id": "chatcmpl_vision",
  "object": "chatgpt.vision",
  "model": "auto",
  "chatgpt_account": "pro-main",
  "mode": "ocr",
  "input_image_count": 1,
  "text": "FW",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "FW"
      }
    }
  ]
}
```

Accepted image references:

- local path on the API server: `"./favicon.png"`
- public URL: `"https://example.com/image.png"`
- data URL: `"data:image/png;base64,..."`
- raw base64 image string
- arrays through `images`, `input_images`, or multimodal chat content

## Image Edits And Composites

`POST /v1/images/edits` uploads one to 10 source images, sends an edit/composite
prompt to ChatGPT image generation, and saves exactly one completed output
image.

```sh
curl 'http://127.0.0.1:8000/v1/images/edits' \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Change the icon letters to FW while preserving the same style.",
    "image": "./favicon.png",
    "aspect_ratio": "1:1"
  }'
```

Multiple source images:

```json
{
  "prompt": "Combine these references into one product poster.",
  "images": ["./subject.png", "./style.png", "./logo.png"],
  "aspect_ratio": "4:3"
}
```

Supported `aspect_ratio` values are `auto`, `1:1`, `3:4`, `9:16`, `4:3`, and
`16:9`.

Important: source images should already match one of those ratios when the
layout must stay stable. If `auto` is used with an unsupported or unusual source
ratio, the output canvas can change size and object positions may shift.

Response:

```json
{
  "created": 1782320100,
  "chatgpt_account": "pro-main",
  "chatgpt_operation_id": "chatgptop_edit",
  "input_image_count": 1,
  "aspect_ratio": "1:1",
  "warnings": [
    "Image edits preserve layout best when the source image already matches one of 1:1, 3:4, 9:16, 4:3, or 16:9."
  ],
  "data": [
    {
      "url": "http://127.0.0.1:8000/v1/chatgpt/files/file_edit/edited.png",
      "download_url": "http://127.0.0.1:8000/v1/chatgpt/files/file_edit/edited.png",
      "path": "/Users/work/Desktop/chatgpt-api/outputs/chatgpt-images/edited.png",
      "filename": "edited.png",
      "content_type": "image/png"
    }
  ]
}
```

## Files And Downloads

Image generation, image edit, and Deep Research routes save completed artifacts
locally. API clients should prefer the returned HTTP download URL:

```json
{
  "data": [
    {
      "url": "http://127.0.0.1:8000/v1/chatgpt/files/file_cat/cat.png",
      "download_url": "http://127.0.0.1:8000/v1/chatgpt/files/file_cat/cat.png",
      "path": "/Users/work/Desktop/chatgpt-api/outputs/chatgpt-images/cat.png",
      "filename": "cat.png"
    }
  ]
}
```

Use `path` only when the client runs on the same machine as the API server. For
LAN clients, start the API with `--host 0.0.0.0` and set
`--public-base-url http://LAN-IP:8000/v1` so generated `download_url` values are
reachable from other devices.

## Deep Research

Deep Research is requested through chat completions with the
`chatgpt-deep-research` model alias:

```sh
curl 'http://127.0.0.1:8000/v1/chat/completions' \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "chatgpt-deep-research",
    "messages": [
      {
        "role": "user",
        "content": "Research whether LLMs can reach AGI. Keep it concise."
      }
    ]
  }'
```

Response:

```json
{
  "id": "chatcmpl_research",
  "object": "chat.completion",
  "model": "chatgpt-deep-research",
  "chatgpt_account": "pro-main",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Done. Deep Research report saved.\npath=/Users/work/Desktop/chatgpt-api/outputs/chatgpt-research/llm-agi.md\ndownload_url=http://127.0.0.1:8000/v1/chatgpt/files/file_research/llm-agi.md"
      },
      "finish_reason": "stop"
    }
  ]
}
```

The markdown file is the artifact. The chat response should not re-summarize
the whole report. Temporary chat mode should be disabled for Deep Research
because ChatGPT Web only supports the full connector flow in normal chat mode.

## Cancellation

Long-running chat, image, and research requests can be cancelled by operation
id:

```sh
curl 'http://127.0.0.1:8000/v1/chatgpt/operations/chatgptop_abc/cancel' \
  -X POST \
  -H 'Authorization: Bearer local-dev-key'
```

Response:

```json
{
  "ok": true,
  "operation": {
    "operation_id": "chatgptop_abc",
    "kind": "image",
    "status": "cancel_requested"
  },
  "provider_stop": {
    "status": "ok"
  }
}
```

If a frontend page refreshes, navigates away, or the user presses cancel, call
this endpoint so the provider request does not keep running in the background.

## Compatibility Scope

The goal is practical API-shape compatibility, not full official API parity.

Current known gaps:

- token usage is returned as zero placeholders
- Chat Completions, Image Generations, bridge Image Edits, and bridge Vision
  routes are exposed; other OpenAI API routes are not
- tool calling uses a prompt bridge because ChatGPT Web does not expose the same
  native tool-call API contract
- `/v1/images/edits` accepts JSON image references, not the full official
  multipart contract

Provider failures are returned as OpenAI-style error objects. The `code` field is
normalized for common ChatGPT Web cases such as `chatgpt_model_limit`,
`chatgpt_rate_limited`, `chatgpt_unsupported_model`, and
`chatgpt_auth_or_browser_challenge`. When `/backend-api/conversation/init`
returns live limit metadata, the error also includes ChatGPT-specific fields such
as `chatgpt_default_model_slug`, `chatgpt_model_limit`,
`chatgpt_blocked_features`, and `chatgpt_limits_progress`.

Keep this document honest as behavior changes.
