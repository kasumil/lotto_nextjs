#!/bin/bash
set -e

# 저장된 버전 파일 경로
VERSION_FILE="version.txt"

# 파일이 없으면 초기화
if [ ! -f "$VERSION_FILE" ]; then
  echo "1.0.0" > "$VERSION_FILE"
fi

# 현재 버전 읽기
CURRENT_VERSION=$(cat "$VERSION_FILE")

# 버전 분리 (MAJOR.MINOR.PATCH)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# PATCH 버전 증가
PATCH=$((PATCH + 1))

# 새 버전 생성
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# 파일에 새 버전 저장
echo "$NEW_VERSION" > "$VERSION_FILE"

# 이미지 이름
IMAGE_BASE="ghcr.io/kasumil/lotto-nextjs"
IMAGE_NAME="$IMAGE_BASE:$NEW_VERSION"

echo "🔧 Building and pushing Docker image: $IMAGE_NAME"

# Docker buildx 빌드 및 푸시
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE_NAME" \
  -t "$IMAGE_BASE:latest" \
  --push \
  .

echo "✅ Done! Image pushed: $IMAGE_NAME and $IMAGE_BASE:latest"
