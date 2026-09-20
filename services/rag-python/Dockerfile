FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RAG_MODEL=sentence-transformers/all-MiniLM-L6-v2

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py documents.py rag.py ./

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
