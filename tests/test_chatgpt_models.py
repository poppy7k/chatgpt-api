from chatgpt_api.providers.chatgpt.models import parse_model_picker, presets_for_version


def test_parse_model_picker_versions_and_presets():
    picker = parse_model_picker(
        {
            "default_model_slug": "gpt-5-5",
            "model_picker_version": 2,
            "models": [
                {"slug": "gpt-5-5"},
                {"slug": "gpt-5-5-thinking"},
                {"slug": "gpt-5-5-pro"},
            ],
            "versions": [
                {
                    "id": "5.5",
                    "display_text_for_intelligence": "GPT-5.5",
                    "enabled": True,
                    "slugs": ["gpt-5-5", "gpt-5-5-thinking", "gpt-5-5-pro"],
                    "intelligence_presets": [
                        {
                            "title": "Instant",
                            "selected_display_title": "5.5 Instant",
                            "model_slug": "gpt-5-5-instant",
                            "lane": "instant",
                        },
                        {
                            "title": "Medium",
                            "selected_display_title": "5.5 Medium",
                            "model_slug": "gpt-5-5-thinking",
                            "lane": "thinking",
                            "thinking_effort": "standard",
                        },
                        {
                            "title": "Pro",
                            "selected_display_title": "5.5 Pro",
                            "model_slug": "gpt-5-5-pro",
                            "lane": "pro",
                        },
                    ],
                }
            ],
        }
    )

    assert picker.default_model_slug == "gpt-5-5"
    assert picker.model_picker_version == 2
    assert picker.model_slugs == ["gpt-5-5", "gpt-5-5-thinking", "gpt-5-5-pro"]
    presets = presets_for_version(picker, "5.5")
    assert [preset.title for preset in presets] == ["Instant", "Medium", "Pro"]
    assert presets[1].thinking_effort == "standard"
    assert presets[2].model_slug == "gpt-5-5-pro"
