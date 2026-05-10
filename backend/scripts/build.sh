#!/usr/bin/env sh
set -eu

yarn install --frozen-lockfile
yarn build
