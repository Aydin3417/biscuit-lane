#!/bin/sh
# Every film this folder ships, one after another (they share one static
# server, so never side by side): about three minutes each.
cd "$(dirname "$0")/../.." || exit 1
for lang in tr en; do
  node store/ads/record.js basket "$lang" || exit 1
  node store/ads/record.js board "$lang" || exit 1
  node store/ads/record.js basket "$lang" --cta=soon || exit 1
done
