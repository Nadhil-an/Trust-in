FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies:
# - gcc, libpq-dev: for psycopg2 (PostgreSQL)
# - libjpeg-dev, libpng-dev, zlib1g-dev: for Pillow (receipt image generation)
# - libffi-dev: for cryptography
# - fonts-liberation: for receipt PDF font rendering
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libjpeg-dev \
    libpng-dev \
    zlib1g-dev \
    libffi-dev \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirment.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirment.txt

COPY . /app/

# Create media directories so receipt images have a place to go
RUN mkdir -p /app/media/donation_receipts /app/media/membership_receipts /app/logs

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "sreelakshmi_trust.asgi:application"]