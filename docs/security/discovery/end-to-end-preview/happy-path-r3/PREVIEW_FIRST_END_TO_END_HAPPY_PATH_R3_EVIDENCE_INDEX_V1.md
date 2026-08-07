# Preview First End-to-End Happy Path R3 — Evidence Index

Change ID: `AI-02H2.2E-R3-PREVIEW-FIRST-END-TO-END-HAPPY-PATH-20260807-01`

## Evidence set

1. `PREVIEW_FIRST_END_TO_END_HAPPY_PATH_R3_V1.md` — narrative gate, baseline, single browser action, post-readback, health, exactly-once observation, and verdict.
2. `PREVIEW_FIRST_END_TO_END_HAPPY_PATH_R3_MATRIX_V1.json` — machine-readable control matrix and sanitized counters.
3. `PREVIEW_FIRST_END_TO_END_HAPPY_PATH_R3_EVIDENCE_INDEX_V1.md` — this bounded evidence inventory.
4. `PREVIEW_FIRST_END_TO_END_HAPPY_PATH_R3_CHANGE_RECORD_V1.md` — repository change and non-change record.

## Evidence boundaries

- All runtime reads were from Preview.
- Firestore evidence is aggregate-only.
- Browser evidence records only the path, action count, sanitized resource hosts, and outcome.
- Cloud logging evidence records only whether an observable callable request existed in the attempt window.
- Tokens, URL fragments, synthetic email values, PII-bearing documents, secrets, HMAC material, API keys, and complete cloud resource identifiers are excluded.
- No Production or Staging runtime was opened or mutated.

## Key observations

| Evidence | Observation |
|---|---|
| Gate | PASS before attempt |
| Containment | Active and unchanged at 1/1/1 |
| Browser action | Exactly 1 click on `Iniciar Diagnóstico` |
| Callable dispatch | 0 observable `createDiscoveryLead` requests |
| Functional writes | 0 leads, sessions, capabilities, completions, events, or notifications |
| Retry | Not performed |
| Final health | Functions 5/5 ACTIVE; Cloud Run 5/5 READY; failed revisions 0; Vercel READY |
| Verdict | `C — BLOCKED` |

The four files listed above are the complete evidence set for this run.
