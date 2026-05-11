#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

REGISTRY="${REGISTRY:-cr.yandex/crpohuj0hvk9maacnvvo}"
TAG="${TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"
DRY_RUN="${DRY_RUN:-0}"

BACKEND_IMAGE="${BACKEND_IMAGE:-${REGISTRY}/pawsport-backend:${TAG}}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-${REGISTRY}/pawsport-frontend:${TAG}}"

run() {
  if [ "${DRY_RUN}" = "1" ]; then
    printf '+'
    printf ' %s' "$@"
    printf '\n'
  else
    "$@"
  fi
}

if [ "${DRY_RUN}" != "1" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required to push images" >&2
    exit 1
  fi

  docker image inspect "${BACKEND_IMAGE}" >/dev/null
  docker image inspect "${FRONTEND_IMAGE}" >/dev/null
fi

echo "push: backend -> ${BACKEND_IMAGE}"
run docker push "${BACKEND_IMAGE}"

echo "push: frontend -> ${FRONTEND_IMAGE}"
run docker push "${FRONTEND_IMAGE}"

echo "push: done"
