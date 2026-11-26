#!/usr/bin/env bash
set -euo pipefail

reviewed_image_config_id='b8d4f86bf8ec78d10782ad21582658ab0148ab09e92fdcc61fdc7196dc3e3ba7'
if [[ ${LOTTO_IMAGE_CONFIG_ID:-} != "$reviewed_image_config_id" ]]; then
  printf '%s\n' '::error title=Lotto image configuration::LOTTO_IMAGE_CONFIG_ID must match the local image pinned by this candidate. Tags and different IDs are refused.' >&2
  exit 2
fi

if [[ ! ${NEXT_PUBLIC_KAKAO_MAP_API_KEY:-} =~ [^[:space:]] ]]; then
  printf '%s\n' '::notice title=Kakao Maps runtime configuration::NEXT_PUBLIC_KAKAO_MAP_API_KEY is unset or blank. The build needs no map key. Set the Kakao Maps JavaScript key in the app runtime to enable maps.' >&2
fi
