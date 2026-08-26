FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app


RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*


COPY requirment.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirment.txt



COPY . /app/


EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "sreelakshmi_trust.asgi:application"]