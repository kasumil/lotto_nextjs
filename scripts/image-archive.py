#!/usr/bin/env python3
"""Bind scanned Docker archives to the bytes and IDs loaded for publication."""
import hashlib
import json
import pathlib
import sys
import tarfile

mode, directory, architecture = sys.argv[1:4]
root = pathlib.Path(directory)
archive = root / "image.tar"
with archive.open("rb") as source:
    archive_hash = hashlib.file_digest(source, "sha256").hexdigest()
with tarfile.open(archive) as tar:
    manifest = json.load(tar.extractfile("manifest.json"))
    if len(manifest) != 1:
        raise ValueError("Expected exactly one release image")
    config_bytes = tar.extractfile(manifest[0]["Config"]).read()
    config = json.loads(config_bytes)
    if config.get("architecture") != architecture or config.get("os") != "linux":
        raise ValueError("Wrong image platform")
    identities = ["sha256:" + hashlib.sha256(config_bytes).hexdigest()]
    if "index.json" in tar.getnames():
        index = json.load(tar.extractfile("index.json"))
        if len(index.get("manifests", [])) != 1:
            raise ValueError("Expected one OCI manifest")
        digest = index["manifests"][0]["digest"]
        blob = tar.extractfile("blobs/sha256/" + digest.removeprefix("sha256:")).read()
        if digest != "sha256:" + hashlib.sha256(blob).hexdigest():
            raise ValueError("Manifest digest mismatch")
        identities.append(digest)
    tags = manifest[0].get("RepoTags", [])
    if len(tags) != 1 or not tags[0].startswith("lotto-security:") or not tags[0].endswith("-" + architecture):
        raise ValueError("Unexpected image tag")
record = {"sha256": archive_hash, "ids": identities, "architecture": architecture, "tag": tags[0]}
report = json.loads((root / "trivy-image.json").read_text())
if report["Metadata"]["ImageID"] not in identities:
    raise ValueError("The scanner inspected a different image")
if mode == "record":
    (root / "archive.json").write_text(json.dumps(record, indent=2) + "\n")
elif mode == "verify":
    if record != json.loads((root / "archive.json").read_text()):
        raise ValueError("Scanned archive changed before publication")
    if len(sys.argv) > 4 and sys.argv[4] not in identities:
        raise ValueError("Docker loaded a different image")
    print(tags[0])
else:
    raise ValueError("Unknown operation")
