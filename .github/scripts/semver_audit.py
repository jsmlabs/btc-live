"""Read-only per-repository release-policy audit.

No Git tag, Release, branch, workflow or repository mutation is performed.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib

SEMVER = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)
KINDS = {"json", "toml", "text", "userscript"}
FORMATS = {"semver", "calendar", "pep440"}


def is_semver(value: str) -> bool:
    match = SEMVER.fullmatch(value)
    if not match:
        return False
    prerelease = match.group(4)
    return not prerelease or all(
        not (p.isdigit() and len(p) > 1 and p.startswith("0"))
        for p in prerelease.split(".")
    )


def version_tuple(value: str) -> tuple[int, int, int] | None:
    if not is_semver(value):
        return None
    match = SEMVER.fullmatch(value)
    assert match is not None
    if match.group(4) or match.group(5):
        return None
    return tuple(map(int, match.group(1, 2, 3)))


def source_version(root: Path, source: dict) -> str:
    if not isinstance(source, dict) or set(source) != {"path", "kind", "key"}:
        raise ValueError("INVALID_VERSION_SOURCE")
    rel = source["path"]
    kind = source["kind"]
    key = source["key"]
    if (not isinstance(rel, str) or not rel or
            Path(rel).is_absolute() or any(p in ("..", ".") for p in Path(rel).parts) or
            kind not in KINDS or not isinstance(key, str)):
        raise ValueError("INVALID_VERSION_SOURCE")
    path = root / rel
    if path.is_symlink() or not path.is_file():
        raise ValueError("MISSING_OR_UNSAFE_VERSION_SOURCE")
    content = path.read_text(encoding="utf-8")
    if kind == "json":
        value = json.loads(content)
        for part in key.split("."):
            value = value[part]
    elif kind == "toml":
        value = tomllib.loads(content)
        for part in key.split("."):
            value = value[part]
    elif kind == "text":
        if key:
            raise ValueError("TEXT_SOURCE_MUST_HAVE_EMPTY_KEY")
        value = content.strip()
    else:
        if key != "@version":
            raise ValueError("UNSUPPORTED_USERSCRIPT_KEY")
        found = re.findall(r"(?m)^\s*//\s*@version\s+(\S+)\s*$", content)
        if len(found) != 1:
            raise ValueError("INVALID_USERSCRIPT_VERSION")
        value = found[0]
    if not isinstance(value, str) or not value or value.strip() != value:
        raise ValueError("INVALID_PROJECT_VERSION")
    return value


def git_tags(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "tag", "--list"], cwd=root, capture_output=True, text=True, check=True
    )
    return sorted(result.stdout.splitlines())


def audit(root: Path, policy: dict, repository: str, tags: list[str]) -> dict:
    required = {
        "schema_version", "repository", "default_branch", "mode",
        "tagging_enabled", "publish_github_releases", "version_format",
        "version_source", "additional_version_sources",
    }
    if not isinstance(policy, dict) or set(policy) != required:
        raise ValueError("INVALID_POLICY_SCHEMA")
    if (policy["schema_version"] != 1 or policy["repository"] != repository or
            not re.fullmatch(r"jsmlabs/[a-z0-9][a-z0-9-]*", repository) or
            policy["default_branch"] not in ("main", "master") or
            policy["mode"] != "AUDIT" or
            policy["tagging_enabled"] is not False or
            policy["publish_github_releases"] is not False or
            policy["version_format"] not in FORMATS or
            not isinstance(policy["additional_version_sources"], list)):
        raise ValueError("UNSAFE_OR_UNSUPPORTED_RELEASE_POLICY")
    version = source_version(root, policy["version_source"])
    if any(source_version(root, x) != version
           for x in policy["additional_version_sources"]):
        raise ValueError("VERSION_SOURCE_DRIFT")
    if policy["version_format"] != "semver":
        status = "ADAPTER_REVIEW_REQUIRED"
    elif not is_semver(version):
        raise ValueError("INVALID_SEMVER_VERSION")
    else:
        stable = [(version_tuple(tag[1:]), tag) for tag in tags if tag.startswith("v")]
        stable = [(value, tag) for value, tag in stable if value is not None]
        if not stable:
            status = "BASELINE_REVIEW_REQUIRED"
        else:
            latest, _ = max(stable)
            current = version_tuple(version)
            status = ("READY_FOR_POLICY_REVIEW" if current == latest else
                      "VERSION_HISTORY_REVIEW_REQUIRED")
    return {
        "repository": repository,
        "project_version": version,
        "status": status,
        "tag_count": len(tags),
        "tagging_enabled": False,
        "publish_github_releases": False,
    }


def main() -> int:
    try:
        root = Path.cwd()
        path = root / ".github" / "release-policy.json"
        if path.is_symlink() or not path.is_file():
            raise ValueError("POLICY_MISSING_OR_UNSAFE")
        policy = json.loads(path.read_text(encoding="utf-8"))
        expected = os.environ.get("GITHUB_REPOSITORY", policy.get("repository", ""))
        result = audit(root, policy, expected, git_tags(root))
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as exc:
        reason = str(exc) if isinstance(exc, ValueError) else "INVALID_INPUT"
        print(json.dumps({"status": "BLOCKED", "reason": reason}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
