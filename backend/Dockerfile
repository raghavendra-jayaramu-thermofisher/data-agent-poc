FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# unixODBC + Microsoft's SQL Server ODBC driver are required for the MSSQL adapter.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg unixodbc unixodbc-dev ca-certificates \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
       | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini
RUN pip install --no-cache-dir .
RUN mkdir -p /app/runtime-data
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
