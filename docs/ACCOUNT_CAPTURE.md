# Account Capture Guide

This project needs a copied ChatGPT Web browser request for each local account.
The capture is used only by your local bridge. It contains session cookies and
tokens, so treat it like a password.

Supported browsers today:

- Safari
- Chrome

Other browsers may work if their copied request details have the same headers
and JSON payload shape, but they are not documented as supported yet.

## Security Rules

- Never commit `secrets/`, `.env`, copied headers, cookies, bearer tokens, or
  raw request captures.
- Prefer one ChatGPT account per browser profile or incognito/private window
  while collecting a capture.
- Do not log out of ChatGPT after collecting the capture. Logging out can revoke
  the browser session and make the capture unusable.
- A capture is temporary. In practice it often lasts around 10 days, but this is
  not guaranteed. Refresh it weekly if you do not want the bridge to stop during
  demos or long work.
- Use account names such as `free-main`, `pro-main`, `free-2`, or `plus_work`.
  These are local aliases you choose, not automatic plan selectors. Account
  names must use English letters, numbers, dash, or underscore only.

## Recommended Capture Routine

The safest routine is to use an incognito/private window, collect one request,
save or paste it into the console, and then leave that browser session signed in.

1. Open `https://chatgpt.com`.
2. Recommended: use a private/incognito window or a dedicated browser profile.
3. Sign in to the account you want to use.
4. Do not sign out after collecting the capture.
5. Open a fresh ChatGPT conversation.
6. Open DevTools:
   - Chrome: `F12` or `Option+Command+I`
   - Safari: enable Develop menu if needed, then open Web Inspector
7. Go to the Network tab.
8. Send any small message, for example `hello`.
9. Search/filter Network for `conversation`.
10. Pick the request to ChatGPT conversation, usually:
    - `https://chatgpt.com/backend-api/f/conversation`
    - sometimes related `conversation/prepare` appears too; the bridge wants the
      real conversation POST plus its request payload.

## Safari Copy Steps

Safari's Web Inspector usually shows the information split across request
headers and request data.

1. Select the `conversation` request.
2. On the right side, open the Headers view.
3. Copy all headers. Copy everything, not only a subset.
4. Find `Request Data:`.
5. Click the arrow/expander next to `Request Data`.
6. Copy the full JSON body shown there.
7. Paste both the full headers and the JSON body into the API console account
   capture modal or save them to a local text file.

The pasted text can be messy. The bridge parser is designed to extract the
important headers and the JSON payload from Safari-style copied text.

## Chrome Copy Steps

Chrome DevTools usually separates the capture into Headers and Payload.

1. Select the `conversation` request.
2. Open the Headers tab.
3. Copy the full request headers section. Include all request headers that
   Chrome shows for that request.
4. Open the Payload tab.
5. Copy the full JSON request payload.
6. Paste both sections into the API console account capture modal or save them
   to a local text file.

If Chrome replay returns `403`, collect a fresh capture from the same browser
session and verify that the payload includes a recent `client_prepare_state`,
sentinel headers, cookies, and authorization header. Safari captures are often
more stable today, but Chrome captures are supported and should be kept in the
same parser path.

## Save Through The Console

1. Start Docker or the local API.
2. Open the console:

   ```text
   http://127.0.0.1:8080
   ```

3. Go to Accounts.
4. Choose Add account or Update capture.
5. Enter an ASCII account name, for example `pro-main`.
6. Paste the full copied capture.
7. Inspect first if you want to see what the parser found.
8. Save only when validation passes.
9. Run Check/Verify for that account.

The console should not save a broken capture silently. It should parse, redact
secrets in summaries, and show which required pieces are missing.

## Save Through The CLI

Save a capture file:

```sh
chatgpt-api admin account add \
  --account pro-main \
  --capture-file ./chatgpt-request.txt \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key local-dev-key
```

Interactive add/update without a prepared file:

```sh
chatgpt-api admin account add --paste \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key local-dev-key
```

The CLI asks for the account name, then accepts pasted headers plus
Payload/Request Data until a line containing only `END_CAPTURE`.

Refresh an existing account:

```sh
chatgpt-api admin account update \
  --account pro-main \
  --capture-file ./chatgpt-request.txt \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key local-dev-key
```

Verify accounts:

```sh
chatgpt-api admin account verify \
  --account all \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key local-dev-key
```

Delete an account:

```sh
chatgpt-api admin account delete \
  --account old-free-main \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key local-dev-key
```

## File Layout

Default local account files:

```text
secrets/accounts/<account>/chatgpt-request.txt
secrets/accounts/<account>/settings.json
```

Docker account files:

```text
/data/secrets/accounts/<account>/chatgpt-request.txt
/data/secrets/accounts/<account>/settings.json
```

The default Compose file mounts host `./secrets/accounts` to
`/data/secrets/accounts`.

## Refresh Schedule

Recommended maintenance:

- Refresh captures once per week for demo accounts.
- Refresh immediately if account check says `403`, session expired, missing
  metadata, or no model/usage metadata returned.
- Keep at least one known-good Pro/Plus account if you plan to demo image
  generation or Deep Research.
- Keep a Free account in the route to prove the bridge can work without a paid
  ChatGPT plan for normal chat.

## Troubleshooting

`403` from ChatGPT:
: The browser session, Cloudflare/session proof, or copied headers no longer
  replay. Collect a fresh capture from the same browser family.

`conversation/init returned no metadata`:
: ChatGPT did not return the limit/model metadata needed for usage display.
  Retry later or refresh the capture.

Only one account routes:
: Check `CHATGPT_ACCOUNTS`, account names, and whether each account capture
  exists under `secrets/accounts/<name>/`.

Image or file upload blocked:
: Check `/v1/chatgpt/usage`. Free accounts can have low or blocked image/upload
  quota. Image edit, OCR, describe, and composite routes all consume upload
  capacity before image generation.

Deep Research blocked:
: Use a normal, non-temporary chat mode and a plan that exposes Deep Research.
  Free accounts may show blocked Deep Research in usage metadata.
