#!/bin/sh
set -e

if [ "${APP_ENV:-production}" = "development" ]; then
  exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
fi

exec uvicorn main:app --host 0.0.0.0 --port 8000
