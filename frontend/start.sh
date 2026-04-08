#!/bin/sh
set -e

if [ "${NODE_ENV:-production}" = "development" ]; then
  exec npm run dev -- --host 0.0.0.0 --port 5173
fi

npm run build
exec npm run preview -- --host 0.0.0.0 --port 5173
