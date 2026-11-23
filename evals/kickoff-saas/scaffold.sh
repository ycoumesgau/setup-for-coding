#!/usr/bin/env bash
# An empty repository, as the owner would have just created it.
set -euo pipefail
git init -q --initial-branch=main
git config user.email eval@example.com
git config user.name eval
git config commit.gpgsign false
