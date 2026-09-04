"""
Agent-Abuse Sentinel -- Adversarial Stress-Test Generator
==========================================================
Generates 60 sessions (20 per sub-pattern) designed to EVADE the Sentinel:
  - Timing slowed and jittered closer to human ranges
  - Mouse/client signal present (mimicking decoy)
  - Lower param_reuse_rate, fewer discount attempts
  - Longer sessions with lower per-minute request density

This is the 'what broke and how we'd address it' story for the panel.

Outputs:
  adversarial_sessions.csv          -- the 60 evasion sessions
  adversarial_eval_report.json      -- recall/precision vs clean holdout

Usage:
  python adversarial_sessions.py
"""

import sys, io

import json
import uuid
import math
import random
import pathlib
import numpy as np
import pandas as pd
from score_session import score_session

SEED = 99
random.seed(SEED)
np.random.seed(SEED)

N_PER_PATTERN = 20
TIME_BUCKETS  = ["morning", "afternoon", "evening", "night"]

SEP  = "-" * 68
SEP2 = "=" * 68


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _sid():
    return str(uuid.uuid4())


def _lognormal_gaps(n, mean_s, sigma):
    mu = math.log(mean_s) - 0.5 * sigma ** 2
    return list(np.random.lognormal(mu, sigma, n))


def _uniform_gaps(n, lo, hi):
    return list(np.random.uniform(lo, hi, n))


def _cumsum(gaps):
    ts = [0.0]
    for g in gaps:
        ts.append(ts[-1] + g)
    return ts


def _irt_stats(ts):
    if len(ts) < 2:
        return ts[0] if ts else 0.0, 0.0, ts[0] if ts else 0.0
    gaps = np.diff(ts)
    return float(gaps.mean()), float(gaps.std(ddof=0)), float(gaps.min())


# ---------------------------------------------------------------------------
# Adversarial generators
# ---------------------------------------------------------------------------

def gen_adversarial_card_testing():
    n_req = random.randint(30, 70)
    mean_t = random.uniform(7.0, 15.0)
    sigma  = random.uniform(0.9, 1.5)
    gaps   = _lognormal_gaps(n_req - 1, mean_t, sigma)
    ts     = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _irt_stats(ts)

    param_reuse = round(random.uniform(0.05, 0.22), 4)
    fail_rate   = round(random.uniform(0.05, 0.18), 4)
    mouse       = True

    return {
        "session_id":                    _sid(),
        "label":                         "abusive",
        "sub_pattern":                   "adv_card_testing",
        "num_requests":                  n_req,
        "session_duration_sec":          round(ts[-1], 3),
        "mean_inter_request_time":       round(mean_irt, 4),
        "std_inter_request_time":        round(std_irt, 4),
        "min_inter_request_time":        round(min_irt, 4),
        "unique_params_touched":         random.randint(2, 12),
        "param_reuse_rate":              param_reuse,
        "failed_request_rate":           fail_rate,
        "endpoint_diversity":            random.randint(1, 2),
        "user_agent_entropy":            round(random.uniform(0.01, 0.10), 4),
        "mouse_or_client_signal_present": mouse,
        "discount_code_attempts":        random.randint(0, 1),
        "geo_ip_consistency":            random.random() < 0.85,
        "time_of_day_bucket":            random.choice(TIME_BUCKETS),
    }


def gen_adversarial_scraper():
    n_req  = random.randint(25, 70)
    mean_t = random.uniform(7.0, 18.0)
    sigma  = random.uniform(1.0, 1.6)
    gaps   = _lognormal_gaps(n_req - 1, mean_t, sigma)
    ts     = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _irt_stats(ts)

    return {
        "session_id":                    _sid(),
        "label":                         "abusive",
        "sub_pattern":                   "adv_scraper",
        "num_requests":                  n_req,
        "session_duration_sec":          round(ts[-1], 3),
        "mean_inter_request_time":       round(mean_irt, 4),
        "std_inter_request_time":        round(std_irt, 4),
        "min_inter_request_time":        round(min_irt, 4),
        "unique_params_touched":         random.randint(5, 14),
        "param_reuse_rate":              round(random.uniform(0.0, 0.15), 4),
        "failed_request_rate":           round(random.uniform(0.0, 0.12), 4),
        "endpoint_diversity":            random.randint(3, 6),
        "user_agent_entropy":            round(random.uniform(0.0, 0.03), 4),
        "mouse_or_client_signal_present": True,
        "discount_code_attempts":        random.randint(0, 1),
        "geo_ip_consistency":            random.random() < 0.80,
        "time_of_day_bucket":            random.choice(TIME_BUCKETS),
    }


def gen_adversarial_promo_abuse():
    n_req  = random.randint(10, 40)
    mean_t = random.uniform(8.0, 20.0)
    sigma  = random.uniform(0.9, 1.4)
    gaps   = _lognormal_gaps(n_req - 1, mean_t, sigma)
    ts     = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _irt_stats(ts)

    return {
        "session_id":                    _sid(),
        "label":                         "abusive",
        "sub_pattern":                   "adv_promo_abuse",
        "num_requests":                  n_req,
        "session_duration_sec":          round(ts[-1], 3),
        "mean_inter_request_time":       round(mean_irt, 4),
        "std_inter_request_time":        round(std_irt, 4),
        "min_inter_request_time":        round(min_irt, 4),
        "unique_params_touched":         random.randint(5, 14),
        "param_reuse_rate":              round(random.uniform(0.05, 0.20), 4),
        "failed_request_rate":           round(random.uniform(0.05, 0.15), 4),
        "endpoint_diversity":            random.randint(2, 5),
        "user_agent_entropy":            round(random.uniform(0.02, 0.18), 4),
        "mouse_or_client_signal_present": True,
        "discount_code_attempts":        random.randint(0, 1),
        "geo_ip_consistency":            random.random() < 0.60,
        "time_of_day_bucket":            random.choice(TIME_BUCKETS),
    }


# ---------------------------------------------------------------------------
# Generate + score + report
# ---------------------------------------------------------------------------

def generate_adversarial_set():
    records = []
    for _ in range(N_PER_PATTERN):
        records.append(gen_adversarial_card_testing())
    for _ in range(N_PER_PATTERN):
        records.append(gen_adversarial_scraper())
    for _ in range(N_PER_PATTERN):
        records.append(gen_adversarial_promo_abuse())
    random.shuffle(records)
    return records


def score_records(records):
    results = []
    for rec in records:
        scored = score_session(rec)
        scored["_true_label"]       = rec["label"]
        scored["_true_sub_pattern"] = rec["sub_pattern"]
        results.append(scored)
    return results


def compute_metrics(results, pattern_filter=None):
    if pattern_filter:
        results = [r for r in results if r["_true_sub_pattern"] == pattern_filter]
    if not results:
        return None

    total     = len(results)
    detected  = sum(1 for r in results if r["tier"] != "pass")
    missed    = total - detected

    high_conf = sum(1 for r in results if r["tier"] == "high_confidence")
    review_q  = sum(1 for r in results if r["tier"] == "review_queue")
    passed    = sum(1 for r in results if r["tier"] == "pass")

    recall = detected / total if total > 0 else 0.0
    return {
        "total":            total,
        "detected":         detected,
        "missed":           missed,
        "recall":           round(recall, 4),
        "high_confidence":  high_conf,
        "review_queue":     review_q,
        "pass_evaded":      passed,
    }


def main():
    print(f"\n{SEP2}")
    print("  ADVERSARIAL STRESS-TEST GENERATOR")
    print(f"{SEP2}")
    print(f"  Generating {N_PER_PATTERN * 3} adversarial sessions (20 per sub-pattern)...")
    print("  Strategy: slow timing, injected mouse signal, reduced rule-fire features")
    print()

    records = generate_adversarial_set()

    df = pd.DataFrame([{k: v for k, v in r.items()} for r in records])
    csv_path = pathlib.Path("adversarial_sessions.csv")
    df.to_csv(csv_path, index=False)
    print(f"  [SAVED] {csv_path}  ({len(df)} rows)")

    print(f"  Scoring with Sentinel (rule + ML hybrid)...")
    scored = score_records(records)

    overall = compute_metrics(scored)
    ct_m    = compute_metrics(scored, "adv_card_testing")
    sc_m    = compute_metrics(scored, "adv_scraper")
    pa_m    = compute_metrics(scored, "adv_promo_abuse")

    print(f"\n{SEP2}")
    print("  ADVERSARIAL RECALL RESULTS (all sessions are abusive)")
    print(SEP2)
    print(f"  {'Segment':<26} {'Total':>6} {'Detected':>9} {'Missed':>7} {'Recall':>8}  {'HiConf':>7} {'RevQ':>6} {'Evaded':>7}")
    print("  " + "-" * 73)

    def row(label, m):
        if m is None:
            return
        print(
            f"  {label:<26} {m['total']:>6} {m['detected']:>9} "
            f"{m['missed']:>7} {m['recall']:>8.4f}  "
            f"{m['high_confidence']:>7} {m['review_queue']:>6} {m['pass_evaded']:>7}"
        )

    row("Overall (adversarial)", overall)
    print("  " + "-" * 73)
    row("  adv_card_testing", ct_m)
    row("  adv_scraper",      sc_m)
    row("  adv_promo_abuse",  pa_m)

    print(f"\n{SEP}")
    print("  COMPARISON: clean holdout vs adversarial stress-test")
    print(SEP)

    eval_path = pathlib.Path("evaluation_report.json")
    clean_note = "(clean holdout results not found -- run evaluate_holdout.py first)"
    clean_recall   = "N/A"
    clean_recall_ct = "N/A"
    clean_recall_sc = "N/A"
    clean_recall_pa = "N/A"
    if eval_path.exists():
        with open(eval_path) as f:
            clean_report = json.load(f)
        clean_recall     = f"{clean_report['hybrid']['recall']:.4f}"
        pp_ml = clean_report['ml'].get('per_pattern', {})
        clean_recall_ct = f"{pp_ml.get('card_testing', {}).get('recall', 0):.4f}" if pp_ml else "N/A"
        clean_recall_sc = f"{pp_ml.get('scraper', {}).get('recall', 0):.4f}"      if pp_ml else "N/A"
        clean_recall_pa = f"{pp_ml.get('promo_abuse', {}).get('recall', 0):.4f}"  if pp_ml else "N/A"
        clean_note = ""

    adv_recall_ct = f"{ct_m['recall']:.4f}" if ct_m else "N/A"
    adv_recall_sc = f"{sc_m['recall']:.4f}" if sc_m else "N/A"
    adv_recall_pa = f"{pa_m['recall']:.4f}" if pa_m else "N/A"

    print(f"  {'Sub-pattern':<22} {'Clean Holdout':>15} {'Adversarial':>13}  {'Delta':>8}")
    print("  " + "-" * 62)

    def delta(c, a):
        try:
            return f"{float(a) - float(c):+.4f}"
        except Exception:
            return "  N/A"

    print(f"  {'Overall recall':<22} {clean_recall:>15} {overall['recall']:>13.4f}  {delta(clean_recall, overall['recall']):>8}")
    print(f"  {'card_testing':<22} {clean_recall_ct:>15} {adv_recall_ct:>13}  {delta(clean_recall_ct, adv_recall_ct):>8}")
    print(f"  {'scraper':<22} {clean_recall_sc:>15} {adv_recall_sc:>13}  {delta(clean_recall_sc, adv_recall_sc):>8}")
    print(f"  {'promo_abuse':<22} {clean_recall_pa:>15} {adv_recall_pa:>13}  {delta(clean_recall_pa, adv_recall_pa):>8}")

    if clean_note:
        print(f"  Note: {clean_note}")

    print(f"\n{SEP}")
    print("  INTERPRETATION")
    print(SEP)
    evaded = overall['pass_evaded']
    total_adv = overall['total']
    print(f"  {evaded} of {total_adv} adversarial sessions evaded detection entirely (passed through).")
    print(f"  {overall['review_queue']} landed in review_queue (caught but uncertain tier).")
    print(f"  {overall['high_confidence']} auto-flagged with high confidence.")
    print()
    print("  What would fix this:")
    print("  1. Velocity features: request COUNT per rolling time window, not just raw total")
    print("  2. Sequence fingerprinting: detect bursty patterns even with human-paced gaps")
    print("  3. Device/network signals: same IP subnet, TLS fingerprint, geolocation")
    print("  4. Historical session graph: flag accounts with recurring review_queue history")
    print("  5. Online learning: retrain threshold midpoints on flagged+confirmed abuse")
    print(SEP2)

    report = {
        "description": "Adversarial stress-test: bots with human-mimicry evasion",
        "evasion_strategies": [
            "Timing slowed above mean_irt threshold (7-20s mean gap)",
            "High timing variance (sigma 0.9-1.6) to avoid std_irt threshold",
            "Mouse/client signal injected (True) to avoid absent_penalty",
            "param_reuse_rate kept below 0.2453 threshold",
            "num_requests kept below 75.75 threshold",
            "discount_code_attempts kept at 0-1 (at/below threshold)",
            "failed_request_rate kept below 0.1948 threshold",
        ],
        "overall": overall,
        "per_pattern": {
            "adv_card_testing": ct_m,
            "adv_scraper":      sc_m,
            "adv_promo_abuse":  pa_m,
        },
        "comparison_vs_clean_holdout": {
            "clean_overall_recall":     clean_recall,
            "adv_overall_recall":       overall['recall'],
            "clean_card_testing_recall": clean_recall_ct,
            "adv_card_testing_recall":  adv_recall_ct,
            "clean_scraper_recall":     clean_recall_sc,
            "adv_scraper_recall":       adv_recall_sc,
            "clean_promo_abuse_recall": clean_recall_pa,
            "adv_promo_abuse_recall":   adv_recall_pa,
        },
        "recommended_mitigations": [
            "Rolling velocity windows (requests per 60s, 300s)",
            "Sequence burst fingerprinting",
            "Device/network identity signals (IP subnet, TLS JA3, geolocation)",
            "Historical account risk score (repeat review_queue sessions)",
            "Online threshold recalibration on confirmed abuse labels",
        ],
    }

    report_path = pathlib.Path("adversarial_eval_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  [SAVED] {report_path}")
    print()


if __name__ == "__main__":
    main()
