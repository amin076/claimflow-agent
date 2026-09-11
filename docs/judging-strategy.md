# Judging Strategy

## Preliminary score alignment

| Criterion | Evidence to show |
|---|---|
| Functionality | One stable end-to-end deployed flow |
| Technical difficulty | ADK orchestration, multimodal extraction, typed contracts, conflict routing |
| Code quality | Modular boundaries, schemas, tests, ADR-style explanations |
| Data/models | Model-choice rationale, cost/latency notes, small synthetic evaluation set |
| Originality | Evidence lineage plus uncertainty-aware operational workflow |
| Differentiation | Contrast with plain OCR and generic chat wrappers |
| Problem significance | Specific case-coordinator workflow |
| Feasibility | Clear production gaps, adoption path, privacy constraints |
| Impact | Measure time and correction effort on the demo benchmark |

## Demo priorities

1. Reliability before feature count.
2. Show the source evidence beside every important field.
3. Demonstrate a genuine conflict and human intervention.
4. Quantify only what the team measures.
5. Name limitations before judges discover them.
6. Keep a recorded fallback for development diagnosis, while the official demo remains live as required.

## Finals pitch arc

Problem → costly manual reconciliation → evidence-first agent workflow → live proof → measured result → safe adoption path.

## Likely judge questions

- Why is this agentic rather than a single prompt?
- What happens when the handwriting is wrong?
- How do you prevent prompt injection from documents?
- Why use both Gemini and deterministic rules?
- What data would a real deployment require?
- How would you measure accuracy and return on investment?
- What does ElevenLabs add to the core workflow?
