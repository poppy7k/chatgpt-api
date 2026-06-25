"""ChatGPT model picker metadata helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class IntelligencePreset:
    title: str
    selected_display_title: str
    model_slug: str
    lane: str
    thinking_effort: str | None = None
    preset_type: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "selected_display_title": self.selected_display_title,
            "model_slug": self.model_slug,
            "lane": self.lane,
            "thinking_effort": self.thinking_effort,
            "preset_type": self.preset_type,
        }


@dataclass(slots=True)
class ModelVersion:
    id: str
    display_text: str
    enabled: bool
    slugs: list[str] = field(default_factory=list)
    presets: list[IntelligencePreset] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "display_text": self.display_text,
            "enabled": self.enabled,
            "slugs": self.slugs,
            "presets": [preset.to_dict() for preset in self.presets],
        }


@dataclass(slots=True)
class ModelPicker:
    default_model_slug: str | None
    model_picker_version: int | None
    model_slugs: list[str] = field(default_factory=list)
    versions: list[ModelVersion] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "default_model_slug": self.default_model_slug,
            "model_picker_version": self.model_picker_version,
            "model_slugs": self.model_slugs,
            "versions": [version.to_dict() for version in self.versions],
        }


def parse_model_picker(payload: dict[str, Any]) -> ModelPicker:
    models = payload.get("models")
    versions = payload.get("versions")
    return ModelPicker(
        default_model_slug=_str_or_none(payload.get("default_model_slug")),
        model_picker_version=_int_or_none(payload.get("model_picker_version")),
        model_slugs=_model_slugs(models if isinstance(models, list) else []),
        versions=_versions_from_payload(versions if isinstance(versions, list) else []),
    )


def presets_for_version(picker: ModelPicker, version_id: str) -> list[IntelligencePreset]:
    for version in picker.versions:
        if version.id == version_id:
            return version.presets
    return []


def _versions_from_payload(values: list[Any]) -> list[ModelVersion]:
    versions: list[ModelVersion] = []
    for value in values:
        if not isinstance(value, dict):
            continue
        version_id = _str_or_none(value.get("id"))
        if not version_id:
            continue
        version = ModelVersion(
            id=version_id,
            display_text=_str_or_none(value.get("display_text_for_intelligence"))
            or _str_or_none(value.get("display_text"))
            or version_id,
            enabled=bool(value.get("enabled")),
            slugs=[slug for slug in value.get("slugs", []) if isinstance(slug, str)],
            presets=_presets_from_payload(value.get("intelligence_presets")),
        )
        versions.append(version)
    return versions


def _presets_from_payload(values: Any) -> list[IntelligencePreset]:
    if not isinstance(values, list):
        return []
    presets: list[IntelligencePreset] = []
    for value in values:
        if not isinstance(value, dict):
            continue
        title = _str_or_none(value.get("title"))
        model_slug = _str_or_none(value.get("model_slug"))
        lane = _str_or_none(value.get("lane"))
        if not title or not model_slug or not lane:
            continue
        presets.append(
            IntelligencePreset(
                title=title,
                selected_display_title=_str_or_none(value.get("selected_display_title")) or title,
                model_slug=model_slug,
                lane=lane,
                thinking_effort=_str_or_none(value.get("thinking_effort")),
                preset_type=_str_or_none(value.get("preset_type")),
            )
        )
    return presets


def _model_slugs(values: list[Any]) -> list[str]:
    slugs: list[str] = []
    for value in values:
        if not isinstance(value, dict):
            continue
        slug = _str_or_none(value.get("slug"))
        if slug and slug not in slugs:
            slugs.append(slug)
    return slugs


def _str_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) else None
