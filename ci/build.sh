#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

REGISTRY="${REGISTRY:-cr.yandex/crpohuj0hvk9maacnvvo}"
TAG="${TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"
PLATFORM="${PLATFORM:-linux/amd64}"

BACKEND_IMAGE="${BACKEND_IMAGE:-${REGISTRY}/pawsport-backend:${TAG}}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-${REGISTRY}/pawsport-frontend:${TAG}}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to build images" >&2
  exit 1
fi

echo "build: backend -> ${BACKEND_IMAGE}"
docker build --platform "${PLATFORM}" -t "${BACKEND_IMAGE}" "${ROOT_DIR}/backend"

echo "build: frontend -> ${FRONTEND_IMAGE}"
docker build --platform "${PLATFORM}" -t "${FRONTEND_IMAGE}" -f "${ROOT_DIR}/frontend/Dockerfile" "${ROOT_DIR}"

echo "build: done"
