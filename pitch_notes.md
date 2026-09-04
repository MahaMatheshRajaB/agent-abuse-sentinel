# Agent-Abuse Sentinel — 5-Minute Video Pitch Script

**Track**: AI Risk Manager | **Event**: Razorpay AI Buildathon 2026

---

## ⏱️ Section 1: The Problem (0:00 - 0:30)

"Hi everyone! I’m presenting **Agent-Abuse Sentinel** — an AI-powered risk detection engine built for the next era of payment APIs.

As commerce shifts to autonomous AI shopping agents, payment endpoints face unprecedented abuse patterns:
1. **Card Testing**: Bots hammering checkout with stolen credentials at machine speed.
2. **Catalog Scraping**: Automated agents scraping pricing and inventory via payment payloads.
3. **Promo Abuse**: Automated discount code stuffing and arbitrage.

Standard rate-limiters are too blunt, and legacy fraud engines depend on human signals like mouse movements or browser headers — signals that non-human AI agents legitimately lack."

---

## ⏱️ Section 2: Why Now & Razorpay Alignment (0:30 - 1:00)

"Why does this matter right now?

Razorpay is pioneering **Agentic Commerce** — enabling AI agents to search, select, and pay autonomously. But here is the central challenge for an AI Risk Manager: **A legitimate AI shopping agent looks like a fraud bot by default.** It is fast, programmatically driven, and headless.

If you block all bot-like traffic, you kill agentic commerce. If you allow all of it, merchants suffer catastrophic chargebacks and promo drain. Sentinel provides the **AI Risk Layer** that separates legitimate agentic traffic from abusive bots."

---

## ⏱️ Section 3: Architecture & Live Demo (1:00 - 2:30)

*(Screen share showing `api.py` and `score_session.py` API call)*

"Let’s walk through the architecture:

1. **Dual Detection Engine**: We pair an explainable, deterministic **Rule-Based Scorer** (deriving mid-point thresholds across 9 telemetry features) with a lightweight **LightGBM Classifier**.
2. **Hybrid Tiering Logic**:
   - **`high_confidence` (Auto-Block)**: Both Rule & ML models flag the session.
   - **`review_queue` (Human Review)**: Only one model flags — preventing false-positive customer blockages while keeping risk visible.
   - **`pass`**: Clean traffic allowed through.

Let's test live:
We send a session payload to `POST /score`. Notice the output JSON:
- **`tier`**: `high_confidence`
- **`ml.probability`**: `0.9983`
- **`signals_fired`**: Explains *exactly why* — e.g. `Requests fired too fast on average (1.18s < 6.31s)` and `High parameter reuse (0.82 > 0.25)`.

This provides complete auditability for fraud analysts."

---

## ⏱️ Section 4: Metrics, Honesty & Adversarial Stress-Test (2:30 - 4:00)

"Let's look at the numbers and be completely honest about our evaluation.

We audited our synthetic data generator to include realistic overlap — including fast legitimate AI shopping agents, power users, and stealthy bots.

On our 300-session locked holdout set (`sessions_holdout.csv`):
- **LightGBM Precision**: 0.9487
- **LightGBM Recall**: 0.9867 (74 out of 75 abusive sessions caught)
- **F1 Score**: 0.9673
- **False Positive Rate**: Only 1.78% (4 out of 225 normal sessions flagged for review).
- **Hybrid Tiering**: Routing 28 ambiguous/fast agent sessions to the `review_queue` ensures 100% abusive recall while protecting legitimate buyers from auto-blocks.

### The 'What Broke' Adversarial Stress-Test
However, static telemetry features can lead to overconfidence. So we built an **Adversarial Stress-Test** (`adversarial_sessions.py`) — 60 bot sessions specifically engineered to evade detection by slowing request cadence (mean IRT 7-20s), injecting fake client signals (`mouse_signal=True`), and capping total volume.

**Result**: Recall dropped to **0.00%**. The static rule thresholds and timing features were completely bypassed when bots mimicked human pacing!

**What we learned & how we'd fix it in production**:
1. **Rolling Velocity Windows**: Track request density per rolling 60s/300s window rather than static session totals.
2. **Device & Network Fingerprinting**: TLS JA3 hashes and IP subnet clustering.
3. **Graph Risk Scoring**: Track account history across multiple review queue entries."

---

## ⏱️ Section 5: Closing (4:00 - 5:00)

"Agent-Abuse Sentinel demonstrates how to protect payment gateways in the age of agentic commerce without destroying customer experience.

By combining deterministic rules for explainability, ML for precision, hybrid tiering for safety, and rigorous adversarial testing, we provide a complete blueprint for AI Risk Management.

Thank you!"
