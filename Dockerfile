FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY services/rag-python/requirements-runtime.txt /tmp/rag-requirements.txt
RUN python3 -m venv /opt/rag-venv \
  && /opt/rag-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/rag-venv/bin/pip install --no-cache-dir -r /tmp/rag-requirements.txt

ENV HF_HOME=/opt/huggingface \
    RAG_MODEL=sentence-transformers/all-MiniLM-L6-v2
RUN /opt/rag-venv/bin/python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Workspace packages expose TypeScript. Keep tsx until the separate compiled-runtime phase.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY services/rag-python/app.py services/rag-python/documents.py services/rag-python/rag.py ./services/rag-python/
COPY scripts/start-production.sh ./scripts/start-production.sh

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    SERVE_WEB=true \
    RAG_PORT=8090

RUN chmod +x ./scripts/start-production.sh \
  && chown -R node:node /app /opt/rag-venv /opt/huggingface

USER node
EXPOSE 8080
CMD ["./scripts/start-production.sh"]
