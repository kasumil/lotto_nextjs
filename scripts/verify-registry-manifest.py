#!/usr/bin/env python3
"""Verify immutable remote manifests against locally scanned image identities."""
import hashlib
import json
import pathlib
import re
import sys

IMAGE_TYPES = {"application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json"}
INDEX_TYPES = {"application/vnd.oci.image.index.v1+json", "application/vnd.docker.distribution.manifest.list.v2+json"}
CONFIG_TYPES = {"application/vnd.oci.image.config.v1+json", "application/vnd.docker.container.image.v1+json"}


def valid_digest(value):
    return isinstance(value, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", value) is not None


def read_verified(path, expected_digest):
    raw = pathlib.Path(path).read_bytes()
    if not valid_digest(expected_digest) or expected_digest != "sha256:" + hashlib.sha256(raw).hexdigest():
        raise ValueError("Remote manifest bytes do not match the immutable digest")
    manifest = json.loads(raw)
    if manifest.get("schemaVersion") != 2:
        raise ValueError("Unsupported remote manifest schema")
    return manifest


def verify_image(path, digest, archive_record, architecture):
    manifest = read_verified(path, digest)
    record = json.loads(pathlib.Path(archive_record).read_text())
    if record.get("architecture") != architecture or manifest.get("mediaType") not in IMAGE_TYPES:
        raise ValueError("Wrong architecture or a non-image remote manifest")
    config = manifest.get("config", {})
    # image-archive.py puts the hash of the verified config bytes first. Those
    # exact bytes contain os/architecture and rootfs DiffIDs. Equality binds
    # both platform and filesystem to the image that was scanned and loaded.
    config_id = record.get("ids", [None])[0]
    if not valid_digest(config_id) or config.get("digest") != config_id or config.get("mediaType") not in CONFIG_TYPES:
        raise ValueError("Remote config differs from the scanned image/platform")
    if not isinstance(config.get("size"), int) or config["size"] <= 0:
        raise ValueError("Invalid remote config descriptor")
    layers = manifest.get("layers")
    if not isinstance(layers, list) or not layers or any(not valid_digest(layer.get("digest")) for layer in layers):
        raise ValueError("Invalid remote layer descriptors")


def verify_index(path, digest, image_digests):
    index = read_verified(path, digest)
    if index.get("mediaType") not in INDEX_TYPES or len(index.get("manifests", [])) != 2:
        raise ValueError("Release index must contain exactly two image manifests")
    if set(image_digests) != {"amd64", "arm64"} or len(set(image_digests.values())) != 2:
        raise ValueError("Expected two distinct scanned platform digests")
    seen = {}
    for descriptor in index["manifests"]:
        platform = descriptor.get("platform", {})
        arch = platform.get("architecture")
        if platform.get("os") != "linux" or arch not in image_digests or arch in seen:
            raise ValueError("Missing, duplicate or unexpected release platform")
        if platform.get("variant") not in (None, "", "v8") or (arch == "amd64" and platform.get("variant")):
            raise ValueError("Unexpected release platform variant")
        if descriptor.get("mediaType") not in IMAGE_TYPES or descriptor.get("digest") != image_digests[arch]:
            raise ValueError("Release index references an unverified image")
        seen[arch] = descriptor["digest"]
    if seen != image_digests:
        raise ValueError("Release platforms do not match the scanned images")


if __name__ == "__main__":
    mode, path, digest, *args = sys.argv[1:]
    if mode == "image":
        verify_image(path, digest, args[0], args[1])
    elif mode == "index":
        verify_index(path, digest, dict(arg.split("=", 1) for arg in args))
    else:
        raise ValueError("Unknown verification mode")
