# Enterprise Mental Model Foundation (EMM)

## Overview
The Enterprise Mental Model (EMM) represents a highly structured, evidence-based, and objective understanding of a prospect's organization.

### Boundaries for AI-01A (Current Phase)
This sprint (AI-01A) exclusively implements the **isolated canonical architecture**, the core pure reducer functions, the confidence policies, and basic selectors. 
It **does not** integrate with the production `ConversationEngine`, `DiscoverPage`, or Firebase. It acts as the functional core that will be wired into the conversational orchestrator in AI-01B.

## Core Principles

1. **Evidence-first (No assumptions)**: 
   No fact is ever considered `CONFIRMED` unless there is direct evidence (usually from the user) supporting it.
2. **Product-neutral**: 
   The model describes the *business reality*, not the *Aura solution*. The `ProductApplicability` is calculated separately and does not pollute the base diagnostics.
3. **Determinism and Idempotency**: 
   State updates are pure functions. Applying the same evidence ID twice will not mutate the model further. Applying equivalent batches of evidence in different orders yields the same final confidence state.
4. **Separation of Concerns**: 
   The model distinctly separates objective observations (`EnterpriseEvidence`) from subjective inferences (`EnterpriseHypothesis`), and both from product mapping.

## State Management Invariants

- **Idempotency**: An evidence with a known `evidenceId` is ignored if applied again.
- **Contradictions**: Evidence with `NEGATIVE` polarity reduces the confidence of an entity. If negative confidence crosses the 0.6 threshold, the entity becomes `CONTRADICTED`. If a direct user correction (`USER_CORRECTION`) contradicts a fact, it becomes `REJECTED`.
- **Coverage**: Model coverage increases only as we gain explicitly `CONFIRMED` facts or foundational identity attributes. `CANDIDATE` domains seeded by the industry do not artificially inflate coverage.
- **Determinism**: The `ConfidenceScore` is derived purely from the collection of `evidenceRefs` attached to an entity, multiplying uncertainties asymptotically to prevent confidence from ever exceeding `1.0`.

## Seed Data
Industry seeding creates predefined structures (e.g., `OperationalDomain`) but ensures they start with a `CANDIDATE` status and `0` confidence, waiting for true conversational evidence to promote them to `CONFIRMED`.

## Confidence Formula
```typescript
positiveUncertainty *= (1 - weight)
negativeUncertainty *= (1 - weight)
positiveConfidence = 1 - positiveUncertainty
negativeConfidence = 1 - negativeUncertainty
finalConfidence = max(0, positiveConfidence - negativeConfidence)
```
Where `weight = sourceWeight * reliability * directness`.
`DERIVED_INFERENCE` acts as a canonical source type with significantly lower weight than direct statements.
