# GROWTH-COMMERCIAL-01

# AI Data Classification Model v1.0


## Status

ACTIVE


## Purpose

This model defines the data classification rules that govern how Aura Growth Intelligence handles information when interacting with AI capabilities.

The objective is to protect enterprise information while enabling controlled AI usage.


---

# Classification Model


## L1 — PUBLIC


Definition:

Publicly available information.


Examples:

- corporate website information;
- public company information;
- industry information;
- public news.


AI Usage:

EXTERNAL AI PERMITTED


---

## L2 — BUSINESS CONTEXT


Definition:

Commercial information that is not considered sensitive.


Examples:

- business objectives;
- campaigns;
- market segments;
- value propositions;
- competitive analysis.


AI Usage:

EXTERNAL AI PERMITTED WITH POLICY


---

## L3 — INTERNAL


Definition:

Internal operational information.


Examples:

- internal processes;
- operational metrics;
- internal strategies;
- operational documents.


AI Usage:

EXTERNAL AI RESTRICTED


Requirements:

- authorization;
- anonymization;
- governance controls.


---

## L4 — CONFIDENTIAL


Definition:

Sensitive business information.


Examples:

- contracts;
- private financial information;
- confidential strategies;
- private customer information.


AI Usage:

EXTERNAL AI NOT PERMITTED BY DEFAULT


---

## L5 — RESTRICTED


Definition:

Highly sensitive information.


Examples:

- sensitive personal data;
- protected HCM information;
- payroll information;
- medical information;
- credentials.


AI Usage:

EXTERNAL AI PROHIBITED


---

# Governance Flow


Data Classification

        |

        v


AI Governance Policy

        |

        v


Provider Routing Decision

        |

        v


AI Capability Execution


---

# Governance Rules


1. Data classification must occur before AI processing.

2. Sensitive information requires explicit governance approval.

3. External providers must not bypass Aura security policies.

4. AI routing decisions must respect classification level.


---

# Certification


GROWTH-COMMERCIAL-01

AI Data Classification Model v1.0


Status:

ACTIVE