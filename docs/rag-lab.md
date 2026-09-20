# ClaimFlow RAG Lab

This lab adds a deliberately isolated Python retrieval service beside the existing Node/TypeScript ClaimFlow application. It is a learning and integration boundary, not part of the production claim-processing workflow.

## Why this shape

The current ClaimFlow Vertex provider is specialised for multimodal claim extraction and JSON-schema output. Reusing that extraction class for RAG would couple two different responsibilities.

The lab instead reuses the existing ClaimFlow Google Cloud configuration and Application Default Credentials on the Node side while Python owns embedding and semantic retrieval.

```text
Question
  |
  v
Python FastAPI RAG service
  |  embeddings + similarity + Top-K
  v
Retrieved evidence
  |
  v
Node/TypeScript lab runner
  |  ClaimFlow config + existing Vertex authentication pattern
  v
Gemini on Vertex AI
  |
  v
Grounded answer
```

The existing claim-processing routes, ADK extraction workflow, Firestore/GCS persistence and human-review state machine remain unchanged. Production now runs the Python retriever as a separate localhost process inside the same Cloud Run container as the Node API. This preserves the HTTP/language boundary without requiring broader Cloud Run IAM privileges.

## Repository additions

```text
services/rag-python/
  app.py
  documents.py
  rag.py
  test_rag.py
  requirements.txt
  Dockerfile

apps/api/src/rag/
  client.ts
  generator.ts
  smoke.ts
  rag.test.ts
```

The Python service currently uses five synthetic ClaimFlow examples so the retrieval mechanics stay visible while learning. It does not ingest production claims.

## 1. Create the Python environment on Windows

From the repository root:

```powershell
python -m venv services\rag-python\.venv
.\services\rag-python\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r services\rag-python\requirements.txt
```

## 2. Run the Python RAG service

With the virtual environment activated:

```powershell
npm run rag:python
```

The service listens on `http://127.0.0.1:8090`.

Check it:

```powershell
Invoke-RestMethod http://127.0.0.1:8090/health
Invoke-RestMethod http://127.0.0.1:8090/ready
```

## 3. Test retrieval without Gemini

In a second terminal:

```powershell
npm run rag:smoke -- --retrieval-only
```

This proves the cross-language boundary:

```text
TypeScript -> HTTP -> Python -> embeddings -> Top-K -> JSON -> TypeScript
```

You can supply another question:

```powershell
npm run rag:smoke -- --retrieval-only "What claims involved mould or condensation?"
```

## 4. Add Gemini generation using ClaimFlow's existing Vertex setup

The RAG lab does not introduce a Gemini API key. It uses the same Google Cloud project, Vertex location, model configuration and ADC pattern as ClaimFlow.

For local Vertex testing, make sure your Application Default Credentials are available and set the same environment used by ClaimFlow:

```powershell
$env:AI_MODE="vertex"
$env:GOOGLE_CLOUD_PROJECT="claimflow-ai-agents"
$env:VERTEX_LOCATION="global"
$env:GEMINI_MODEL="gemini-3.5-flash"

npm run rag:smoke
```

If ADC is not configured on the machine, authenticate with the Google Cloud CLI using your normal development identity rather than creating a service-account key file.

The full path becomes:

```text
Question
  -> Python embedding
  -> semantic similarity
  -> Top-K evidence
  -> grounded prompt
  -> Gemini on Vertex AI
  -> answer
```

## 5. Hallucination/grounding exercise

Ask a question whose answer is absent from the synthetic evidence:

```powershell
npm run rag:smoke -- "What was the total repair cost?"
```

The grounded prompt explicitly instructs Gemini to answer:

```text
There is not enough evidence to answer the question.
```

when the retrieved evidence does not contain the requested fact.

## 6. Run tests

Node/TypeScript tests remain part of the existing Vitest suite:

```powershell
npm test -- apps/api/src/rag/rag.test.ts
```

Python tests:

```powershell
python -m pytest services/rag-python/test_rag.py
```

The Python unit tests inject a fake encoder, so CI does not need to download the Hugging Face model just to validate ranking and the API contract.

## Deployment boundary

The Python lab still has its own Dockerfile for local or future independent deployment:

```powershell
docker build -t claimflow-rag-lab services/rag-python
docker run --rm -p 8090:8090 claimflow-rag-lab
```

For the current production acceptance path, the main ClaimFlow image also installs the Python runtime and starts FastAPI on `127.0.0.1:8090`. Node talks to that process over HTTP and the external RAG route remains protected by the generated internal bearer token.

```text
Cloud Run claimflow-api container
  ├─ Node/Fastify :8080
  │    └─ /api/lab/rag/query
  │          ↓
  └─ Python/FastAPI :8090 (localhost only)
       └─ SentenceTransformer retrieval
```

We first attempted a separate private `claimflow-rag-lab` Cloud Run service. The GitHub deployment identity can deploy source services but intentionally cannot change Cloud Run IAM policies, so the new service remained private and could not be invoked by the deployment verifier. Rather than grant the deployer Cloud Run Admin, the production learning path is co-located for now.

A future independent microservice deployment should grant the ClaimFlow runtime identity only the Cloud Run Invoker permission on the RAG service using an IAM-admin bootstrap step.

The current SentenceTransformer corpus is still synthetic and in-memory. Before using RAG in the real claim-processing workflow we should evaluate persistent vector storage, chunking, metadata filters, hybrid retrieval, reranking and retrieval evaluation.

## Next integration steps

After the lab passes locally:

1. replace the in-memory sample corpus with synthetic/redacted ClaimFlow documents;
2. add chunking and metadata;
3. introduce a persistent vector store;
4. evaluate retrieval quality with labelled questions;
5. keep the protected lab route separate from the production claim-processing workflow;
6. split Python back into an independently authenticated Cloud Run microservice after its service-to-service IAM bootstrap is available;
7. only then consider RAG as an ADK tool in the real claim workflow.

This sequencing keeps the evidence-first production path stable while the RAG design is still being learned and evaluated.
