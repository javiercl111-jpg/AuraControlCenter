# Enterprise Knowledge Graph (EKG) Design

## Overview
The Enterprise Knowledge Graph (AI-01B) forms the immutable, evidence-first relational layer built on top of the Enterprise Mental Model (EMM). It is designed to capture the structural relationships (e.g., processes affecting risks, capabilities mitigating pain points) within an organization, backed by deterministic identity and strict traceability to primary evidence.

## Core Principles
1. **Deterministic Identity:** Nodes and relationships are uniquely and deterministically identifiable via SHA-256 hashes of their semantic components. This guarantees idempotency and prevents duplication.
2. **Immutability and Pure Operations:** State transitions in the graph are achieved via pure, side-effect-free functions that enforce invariants and return new instances of the graph.
3. **Evidence-Driven Confidence:** Relationships begin as `CANDIDATE` and are elevated to `CONFIRMED` or `PARTIALLY_SUPPORTED` strictly based on evidence quality via predefined confidence policies (with specific thresholds for `CAUSES`, `AFFECTS`, and `RELATED_TO`).
4. **Invariant Protection:** Strict invariants guarantee graph integrity (e.g., no self-loops, strict status-to-confidence coupling, mandatory existence of source/target nodes).
5. **Cycle Tolerance via Traversals:** Instead of forcing global acyclic constraints (which real-world business models often violate), traversals handle cycles organically by maintaining visited sets and imposing depth limits.

## Contracts

### `GraphNode`
Represents an entity in the enterprise context (e.g., PROCESS, RISK, CAPABILITY).
- Tracks status (`CANDIDATE`, `CONFIRMED`, etc.).
- Contains a reference (`mentalModelRef`) to its canonical EMM base entity once linked.

### `EnterpriseRelationship`
Represents a directed typed edge between two `GraphNode`s.
- `sourceId` and `targetId`.
- `type`: `AFFECTS`, `CAUSES`, `RELATED_TO`, `DEPENDS_ON`, `MITIGATES`, `EXACERBATES`, `CONTAINS`, `IMPLEMENTS`, `RESOLVES`.
- `confidence`: Decimal between 0.0 and 1.0 based on evidence reliability.
- `evidenceRefs`: List of IDs mapping to `EnterpriseEvidence`.

## Architecture

The foundation resides within `src/modules/intelligence/enterprise-model/graph/`:
- **`domain/types.ts`:** Core interface declarations.
- **`domain/identity.ts`:** Cryptographic deterministic hashing.
- **`domain/invariants.ts`:** Comprehensive validation for 12 core rules.
- **`policies/confidence.ts`:** Policy mapping evidence reliability to relationship confidence levels.
- **`services/operations.ts`:** Pure operations managing graph growth and evolution (`upsertGraphNode`, `applyGraphEvidenceBatch`, etc.).
- **`selectors/selectors.ts`:** Node/Edge querying APIs.
- **`selectors/traversal.ts`:** Graph walking and pathfinding APIs.

## Integration Downstream
The EKG is intended to be hydrated and analyzed by subsequent modules in the Executive Intelligence Discovery™ suite:
- **AI-01C:** Extracts conversational evidence per turn to batch-apply to the EKG.
- **AI-01D:** Computes coverage metrics and determines knowledge gaps by querying unconfirmed or low-confidence EKG subgraphs.
- **AI-01E:** Formulates follow-up questions targeting `CANDIDATE` edges.
- **AI-01F, G, H:** Perform deep reasoning and generate the Executive Dossier and Enterprise Radiography using the confirmed EKG foundation.
