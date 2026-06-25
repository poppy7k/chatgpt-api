"""Local timezone helpers for ChatGPT Web payloads."""

from __future__ import annotations

import os
import time
from datetime import datetime
from pathlib import Path


def local_timezone_payload() -> dict[str, int | str]:
    return {
        "timezone_offset_min": local_timezone_offset_min(),
        "timezone": local_timezone_name(),
    }


def local_timezone_offset_min() -> int:
    """Return the JavaScript-style timezone offset in minutes.

    JavaScript's Date#getTimezoneOffset returns UTC-local, so Bangkok is -420
    and New York summer time is 240.
    """

    now = datetime.now().astimezone()
    offset = now.utcoffset()
    if offset is None:
        return 0
    return -int(offset.total_seconds() / 60)


def local_timezone_name() -> str:
    env_tz = _timezone_from_env()
    if env_tz:
        return env_tz

    localtime_tz = _timezone_from_localtime_symlink()
    if localtime_tz:
        return localtime_tz

    is_dst = time.localtime().tm_isdst
    if is_dst > 0 and len(time.tzname) > 1 and time.tzname[1]:
        return time.tzname[1]
    if time.tzname and time.tzname[0]:
        return time.tzname[0]
    return "UTC"


def _timezone_from_env() -> str | None:
    value = os.environ.get("TZ", "").strip()
    if not value:
        return None
    if value.startswith(":"):
        value = value[1:]
    if value.startswith("/"):
        return None
    return value or None


def _timezone_from_localtime_symlink() -> str | None:
    localtime = Path("/etc/localtime")
    try:
        target = localtime.resolve(strict=True)
    except OSError:
        return None

    parts = target.parts
    for marker in ("zoneinfo", "zoneinfo.default"):
        if marker not in parts:
            continue
        index = parts.index(marker)
        timezone_parts = parts[index + 1 :]
        if timezone_parts:
            return "/".join(timezone_parts)
    return None
