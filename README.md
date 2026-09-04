# Agent-Abuse Sentinel

> **Razorpay AI Buildathon 2026 — Track: AI Risk Manager**

A real-time fraud detection system for agentic-commerce payment APIs.  
Detects card-testing bots, scrapers, and promo-abusers using a hybrid  
rule-based + LightGBM approach with per-session explainability.

---

## The Problem

AI shopping agents — autonomous bots that browse, compare, and purchase on behalf of users — are the next frontier of commerce. Razorpay's agentic checkout infrastructure enables this. So does the abuse.

Three threat classes emerge immediately:

| Threat | Behaviour | Real Cost |
|---|---|---|
| **Card testing** | Bot hammers `/charge` with stolen card numbers at machine speed | Chargebacks, card network fines, merchant bans |
| **Catalog scraping** | Bot scans entire product/price catalog through checkout API | Competitive intelligence theft, infra cost |
| **Promo abuse** | Bot cycles discount codes across synthetic accounts | Direct revenue loss, promotion budget exhaustion |

Human fraud analysts cannot scale to the volume that agentic systems produce. Automated detection is not optional — it is table stakes.

---

## Why Now

Razorpay's agentic commerce push (2025–2026) routes non-human sessions through the same payment API as legitimate users. The signal-to-noise problem is new: **a legitimate AI shopping agent looks like a bot by definition** — it's fast, it's programmatic, and it has no mouse. The Sentinel is designed to distinguish *abusive* bots from *legitimate* agentic traffic.

---

## Architecture

```
sessions_*.csv                     Labeled synthetic dataset (1 000 sessions)
     |
     v
data_generator.py                  Generates realistic normal + abusive sessions
     |
     +---> sessions_train.csv       70% stratified split (locked for training only)
     +---> sessions_holdout.csv     30% LOCKED until final evaluation
     |
     v
train_sentinel.py                  Trains two detectors on sessions_train.csv
     |
     +---> models/rule_thresholds.json    Deterministic rule scorer (explainable)
     +---> models/lgbm_model.pkl          LightGBM classifier (AI judgment)
     +---> models/feature_columns.json   Ordered feature list
     |
     v
score_session.py                   Inference + explainability layer
     |                             Returns tier + rule breakdown + ML probability
     |                             + human-readable signals_fired
     v
api.py  (FastAPI)                  REST API for Stitch UI integration
     |
     +--- POST /score              One session -> full scored result
     +--- POST /score_batch        List of sessions or CSV upload
     +--- GET  /health             Liveness + ML availability check
     |
     v
evaluate_holdout.py                Final holdout evaluation (run ONCE)
adversarial_sessions.py            Adversarial stress-test (evasion scenarios)
```

### Hybrid Tiering Logic

```
Rule score >= 5   AND   ML probability >= 0.10  -->  high_confidence  (auto-block)
Rule score >= 5   OR    ML probability >= 0.10  -->  review_queue     (human review)
Neither fires                                   -->  pass
```

The rule scorer provides explainability; the ML model catches edge cases the rules miss (and vice versa). The review queue separates uncertain cases from confident ones — an analyst sees why, not just what.

---

## Quickstart

### Prerequisites

```bash
pip install -r requirements.txt
```

### Run in order

```bash
# 1. (Already done) Generate synthetic dataset
python data_generator.py

# 2. Train both detectors
python train_sentinel.py

# 3. Score individual sessions with full explanation
python score_session.py --sample 8 --out demo_fixtures.json

# 4. Run final holdout evaluation (ONCE — do not re-run to retune)
python evaluate_holdout.py

# 5. Run adversarial stress-test
python adversarial_sessions.py

# 6. Start the API server
uvicorn api:app --reload --port 8000
```

### API usage

```bash
# Health check
curl http://localhost:8000/health

# Score one session
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{
    "num_requests": 350,
    "session_duration_sec": 412.5,
    "mean_inter_request_time": 1.18,
    "std_inter_request_time": 0.43,
    "min_inter_request_time": 0.21,
    "unique_params_touched": 5,
    "param_reuse_rate": 0.82,
    "failed_request_rate": 0.67,
    "endpoint_diversity": 1,
    "user_agent_entropy": 0.02,
    "mouse_or_client_signal_present": false,
    "discount_code_attempts": 0,
    "geo_ip_consistency": true,
    "time_of_day_bucket": "night"
  }'

# Batch score a CSV
curl -X POST http://localhost:8000/score_batch \
  -F "file=@sessions_train.csv"
```

---

## Metrics (Final Holdout — 300 sessions with realistic class overlap)

| Metric | Rule-Based | LightGBM | Hybrid (Union) |
|---|---|---|---|
| **Precision** | 0.7447 | **0.9487** | 0.7500 |
| **Recall** | 0.9333 | **0.9867** | **1.0000** |
| **F1** | 0.8284 | **0.9673** | 0.8571 |
| **FPR** | 0.1067 | **0.0178** | 0.1111 |
| **False Positives** | 24 / 225 normal | 4 / 225 normal | 25 / 225 normal |
| **False Negatives** | 5 missed | 1 missed | 0 missed |

### Per sub-pattern recall (holdout)

| Sub-pattern | Rule | LightGBM | Hybrid |
|---|---|---|---|
| `card_testing` | 1.0000 | 1.0000 | 1.0000 |
| `scraper` | 0.9524 | 1.0000 | 1.0000 |
| `promo_abuse` | 0.8621 | 0.9655 | 1.0000 |

Full machine-readable results: [`evaluation_report.json`](evaluation_report.json)

---

## Honest Limitations & Adversarial Stress-Test Findings

> This section reflects rigorous, real-world evaluation discipline.

### 1. Class Overlap & Realistic AI Agent Traffic
Our dataset includes fast legitimate AI shopping agents, power users, and stealthy bots. While LightGBM retains a high **96.73% F1 score** and **1.78% False Positive Rate**, simpler rule-based heuristics trigger higher false positives (10.67% FPR) on fast, headless AI shopping agents. This underscores why hybrid ML + rule tiering is required for agentic commerce.

### 2. Adversarial Evasion Stress-Test
The adversarial stress-test (`adversarial_sessions.py`) evaluates 60 bot sessions specifically engineered to evade detection by slowing request cadence (mean IRT 7–20s), injecting spoofed client signals (`mouse_signal=True`), and capping total request volume.

**Result**: Recall drops to **0.00%** on the adversarial set (`adversarial_eval_report.json`). Static telemetry features and static rule thresholds are completely bypassed when an attacker mimics human pacing.

### 3. Production Readiness Requirements
To mitigate human-mimicry evasion in production, payment platforms require:
- **Rolling Velocity Windows**: Request counts per rolling 60s/300s window rather than static session totals.
- **TLS & Network Fingerprinting**: TLS JA3 hashes, IP subnet clustering, and BGP AS threat scoring.
- **Account Graph Risk Scoring**: Flagging repeat review-queue entries for the same account or credit card.
- **Online Model Recalibration**: Continuous threshold drift adaptation against emerging evasion strategies.

---

## Frontend & Backend Integration

- **Backend**: FastAPI REST API (`api.py`) exposing `POST /score`, `POST /score_batch`, and `GET /health`.
- **Frontend Console**: React / Vite Security Console UI (`src/App.tsx`) with dynamic auto-loading of scored session fixtures ([demo_fixtures.json](demo_fixtures.json)) and real-time backend status indicators.

### 4. Defense-only
This system is purely defensive — it does not take any action beyond classification and tiering. Blocking, rate-limiting, and challenge injection are outside scope and would be handled by the platform layer.

---

## Project Files

| File | Purpose |
|---|---|
| `data_generator.py` | Synthetic dataset generation |
| `train_sentinel.py` | Model training (rule + LightGBM) |
| `score_session.py` | Inference + explainability layer |
| `api.py` | FastAPI REST endpoint |
| `evaluate_holdout.py` | Final holdout evaluation (run once) |
| `adversarial_sessions.py` | Adversarial evasion stress-test |
| `models/rule_thresholds.json` | Saved rule config |
| `models/lgbm_model.pkl` | Saved LightGBM model |
| `evaluation_report.json` | Holdout evaluation results |
| `adversarial_eval_report.json` | Adversarial stress-test results |
| `demo_fixtures.json` | Sample scored sessions for UI |
