import base64
import json

from chatgpt_api.providers.chatgpt.proof import decode_proof_config, generate_proof_token


def test_decode_proof_config_from_header():
    config = [4000, "date", None, 77, "ua"]
    encoded = base64.b64encode(json.dumps(config).encode()).decode().rstrip("=")

    decoded = decode_proof_config(f"gAAAAAB{encoded}~S")

    assert decoded == config


def test_generate_proof_token_solves_easy_challenge():
    config = [4000, "date", None, 77, "ua"]

    token = generate_proof_token(True, seed="seed", difficulty="ffff", user_agent="ua", proof_config=config)

    assert token is not None
    assert token.startswith("gAAAAAB")
