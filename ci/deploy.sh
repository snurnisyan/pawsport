#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

REGISTRY="${REGISTRY:-cr.yandex/crpohuj0hvk9maacnvvo}"
TAG="${TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"
INSTANCE_ID="${INSTANCE_ID:-epdqp7lemq7112naaprs}"
DRY_RUN="${DRY_RUN:-0}"
LOCAL_COMPOSE_FILE="${LOCAL_COMPOSE_FILE:-${ROOT_DIR}/docker-compose.yc.yaml}"
RENDERED_COMPOSE_FILE="${RENDERED_COMPOSE_FILE:-${TMPDIR:-/tmp}/pawsport-compose-${TAG}.yaml}"
RESTART_INSTANCE="${RESTART_INSTANCE:-0}"

run() {
  if [ "${DRY_RUN}" = "1" ]; then
    printf '+'
    printf ' %s' "$@"
    printf '\n'
  else
    "$@"
  fi
}

render_compose() {
  awk -v registry="${REGISTRY}" -v tag="${TAG}" '
    /image: ".*\/pawsport-backend:/ {
      sub(/image: ".*"/, "image: \"" registry "/pawsport-backend:" tag "\"")
    }
    /image: ".*\/pawsport-frontend:/ {
      sub(/image: ".*"/, "image: \"" registry "/pawsport-frontend:" tag "\"")
    }
    { print }
  ' "${LOCAL_COMPOSE_FILE}" > "${RENDERED_COMPOSE_FILE}"
}

if [ "${DRY_RUN}" != "1" ]; then
  if ! command -v yc >/dev/null 2>&1; then
    echo "yc is required to update the compute instance container spec" >&2
    exit 1
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "git is required to resolve the default image tag" >&2
    exit 1
  fi
fi

if [ ! -f "${LOCAL_COMPOSE_FILE}" ]; then
  echo "compose file not found: ${LOCAL_COMPOSE_FILE}" >&2
  exit 1
fi

echo "deploy: render compose -> ${RENDERED_COMPOSE_FILE}"
render_compose

echo "deploy: update instance compose spec -> ${INSTANCE_ID}"
run yc compute instance update-container --id "${INSTANCE_ID}" --docker-compose-file "${RENDERED_COMPOSE_FILE}"

if [ "${RESTART_INSTANCE}" = "1" ]; then
  echo "deploy: restart instance -> ${INSTANCE_ID}"
  run yc compute instance restart --id "${INSTANCE_ID}"
fi

echo "deploy: done (${REGISTRY}/pawsport-backend:${TAG}, ${REGISTRY}/pawsport-frontend:${TAG})"
