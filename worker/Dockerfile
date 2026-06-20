FROM python:3.12-slim

WORKDIR /app

# psycopg[binary] ships wheels — no system libpq/build tools needed.
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

# Batch CLI: pass args via `docker compose run --rm worker <args>`.
ENTRYPOINT ["garmin-ingest"]
CMD ["--help"]
