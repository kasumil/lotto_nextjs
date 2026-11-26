#!/usr/bin/env python3
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "b8d4f86bf8ec78d10782ad21582658ab0148ab09e92fdcc61fdc7196dc3e3ba7"
FAKE_MAP_KEY = "isolated-map-config-placeholder"


def invoke(args, image=None, key=None):
    env = os.environ.copy()
    for variable, value in (("LOTTO_IMAGE_CONFIG_ID", image), ("NEXT_PUBLIC_KAKAO_MAP_API_KEY", key)):
        env.pop(variable, None)
        if value is not None:
            env[variable] = value
    return subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)


class ComposeContract(unittest.TestCase):
    def compose(self, image=None, key=None):
        return invoke(["docker", "compose", "--env-file", "/dev/null", "--project-name", "lotto-pr3-contract",
                       "-f", "deploy/lotto.compose.fragment.yaml", "config", "--format", "json"], image, key)

    def check_config(self, image=None, key=None):
        return invoke(["bash", "scripts/check-lotto-compose.sh"], image, key)

    def test_default_compose_cannot_start_without_image_id(self):
        output = self.compose()
        self.assertNotEqual(output.returncode, 0)
        self.assertIn("Set LOTTO_IMAGE_CONFIG_ID to the verified local image config ID", output.stderr)

    def test_wrong_or_mutable_image_is_rejected_and_cannot_override_pin(self):
        for image in (None, "latest", "ghcr.io/kasumil/lotto-nextjs:latest", "b8d4f86", "0" * 64):
            with self.subTest(image=image):
                output = self.check_config(image)
                self.assertEqual(output.returncode, 2)
                self.assertIn("Tags and different IDs are refused", output.stderr)
        config = self.compose("latest")
        self.assertEqual(config.returncode, 0, config.stderr)
        self.assertEqual(json.loads(config.stdout)["services"]["lotto"]["image"], "sha256:" + IMAGE)

    def test_exact_image_loopback_and_no_pull(self):
        output = self.compose(IMAGE, FAKE_MAP_KEY)
        self.assertEqual(output.returncode, 0, output.stderr)
        config = json.loads(output.stdout)
        service = config["services"]["lotto"]
        self.assertEqual(service["image"], "sha256:" + IMAGE)
        self.assertEqual(service["pull_policy"], "never")
        self.assertEqual(service["platform"], "linux/amd64")
        self.assertEqual(service["restart"], "unless-stopped")
        self.assertEqual(service["environment"]["NEXT_PUBLIC_KAKAO_MAP_API_KEY"], FAKE_MAP_KEY)
        self.assertEqual(len(service["ports"]), 1)
        port = service["ports"][0]
        self.assertEqual((port["host_ip"], str(port["published"]), port["target"]), ("127.0.0.1", "4102", 4100))
        self.assertTrue(config["networks"]["kasumil-platform"]["external"])
        self.assertEqual(config["networks"]["kasumil-platform"]["name"], "kasumil-platform_default")

    def test_missing_map_key_emits_runtime_notice_without_failing_build_contract(self):
        for key in (None, "  "):
            output = self.check_config(IMAGE, key)
            self.assertEqual(output.returncode, 0)
            self.assertIn("NEXT_PUBLIC_KAKAO_MAP_API_KEY is unset or blank", output.stderr)
            self.assertIn("The build needs no map key", output.stderr)
            self.assertIn("app runtime", output.stderr)
        supplied = self.check_config(IMAGE, FAKE_MAP_KEY)
        self.assertEqual(supplied.returncode, 0)
        self.assertEqual(supplied.stdout + supplied.stderr, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
