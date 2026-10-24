import json
from pathlib import Path
import tempfile
import unittest

from semver_audit import audit, is_semver, source_version


class ReleasePolicyAuditTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "package.json").write_text(
            json.dumps({"version": "1.2.3"}), encoding="utf-8"
        )
        self.policy = {
            "schema_version": 1,
            "repository": "jsmlabs/example",
            "default_branch": "main",
            "mode": "AUDIT",
            "tagging_enabled": False,
            "publish_github_releases": False,
            "version_format": "semver",
            "version_source": {"path": "package.json", "kind": "json", "key": "version"},
            "additional_version_sources": [],
        }

    def test_valid_semver(self):
        self.assertTrue(is_semver("0.1.0"))
        self.assertTrue(is_semver("1.2.3-rc.1"))
        for bad in ("01.2.3", "1.2", "1.2.3-01", "2026.10.13.1", "0.3.0.dev8"):
            self.assertFalse(is_semver(bad))

    def test_no_tags_require_baseline_review(self):
        value = audit(self.root, self.policy, "jsmlabs/example", [])
        self.assertEqual("BASELINE_REVIEW_REQUIRED", value["status"])
        self.assertFalse(value["tagging_enabled"])

    def test_existing_tag_requires_policy_review(self):
        value = audit(self.root, self.policy, "jsmlabs/example", ["v1.2.3"])
        self.assertEqual("READY_FOR_POLICY_REVIEW", value["status"])
        value = audit(self.root, self.policy, "jsmlabs/example", ["v1.2.2"])
        self.assertEqual("VERSION_HISTORY_REVIEW_REQUIRED", value["status"])

    def test_block_publication_and_wrong_repo(self):
        self.policy["tagging_enabled"] = True
        with self.assertRaisesRegex(ValueError, "UNSAFE_OR_UNSUPPORTED"):
            audit(self.root, self.policy, "jsmlabs/example", [])
        self.policy["tagging_enabled"] = False
        with self.assertRaisesRegex(ValueError, "UNSAFE_OR_UNSUPPORTED"):
            audit(self.root, self.policy, "jsmlabs/other", [])

    def test_non_semver_formats_abstain(self):
        self.policy["version_format"] = "calendar"
        (self.root / "package.json").write_text(
            json.dumps({"version": "2026.10.13.1"}), encoding="utf-8"
        )
        value = audit(self.root, self.policy, "jsmlabs/example", [])
        self.assertEqual("ADAPTER_REVIEW_REQUIRED", value["status"])

    def test_drift_and_unsafe_sources_fail(self):
        (self.root / "other.json").write_text(
            json.dumps({"version": "1.2.4"}), encoding="utf-8"
        )
        self.policy["additional_version_sources"].append(
            {"path": "other.json", "kind": "json", "key": "version"}
        )
        with self.assertRaisesRegex(ValueError, "VERSION_SOURCE_DRIFT"):
            audit(self.root, self.policy, "jsmlabs/example", [])
        with self.assertRaisesRegex(ValueError, "INVALID_VERSION_SOURCE"):
            source_version(self.root, {"path": "../outside", "kind": "text", "key": ""})


if __name__ == "__main__":
    unittest.main()
