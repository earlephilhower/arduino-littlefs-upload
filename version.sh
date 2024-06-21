#!/bin/bash
tmp=$(mktemp)
jq '.version = "'$1'"' ./package.json > "$tmp"
mv "$tmp" ./package.json
git tag $1
