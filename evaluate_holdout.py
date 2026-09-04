"""
Agent-Abuse Sentinel -- FINAL HOLDOUT EVALUATION
==================================================
This is the ONE AND ONLY time sessions_holdout.csv is read.
No thresholds are modified, no models are retrained based on these results.
Results are reported as-is, even if imperfect.

Reads:
  sessions_holdout.csv
  models/rule_thresholds.json
  models/lgbm_model.pkl
  models/feature_columns.json

Writes:
  evaluation_report.json
"""

import sys, io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import json
import pickle
import pathlib
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix

SEP  = "-" * 72
SEP2 = "=" * 72

MODELS_DIR   = pathlib.Path("models")
HOLDOUT_PATH = "sessions_holdout.csv"

# =============================================================================
#  FEATURE ENGINEERING  (must match train_sentinel.py exactly)
# =============================================================================

def build_features(X_raw: pd.DataFrame, expected_cols: list[str]) -> pd.DataFrame:
    X = X_raw.copy()
    for col in ["mouse_or_client_signal_present", "geo_ip_consistency"]:
        X[col] = X[col].astype(int)
    X = pd.get_dummies(X, columns=["time_of_day_bucket"], drop_first=False)
    # Align columns to training set (handles any missing OHE dummies)
    X = X.reindex(columns=expected_cols, fill_value=0)
    return X


# =============================================================================
#  RULE SCORER  (identical logic to train_sentinel.py)
# =============================================================================

def rule_score(row: pd.Series, t: dict) -> int:
    s  = 0
    s += int(row["param_reuse_rate"]            >  t["param_reuse_rate_gt"])
    s += int(row["num_requests"]                >  t["num_requests_gt"])
    s += int(row["mean_inter_request_time"]     <  t["mean_inter_request_time_lt"])
    s += int(row["std_inter_request_time"]      <  t["std_inter_request_time_lt"])
    s += int(row["min_inter_request_time"]      <  t["min_inter_request_time_lt"])
    s += int(row["failed_request_rate"]         >  t["failed_request_rate_gt"])
    s += int(row["unique_params_touched"]       >  t["unique_params_touched_gt"])
    s += int(row["discount_code_attempts"]      >  t["discount_code_attempts_gt"])
    s += int(row["mouse_or_client_signal_present"] == 0) * t["mouse_signal_absent_penalty"]
    return s


# =============================================================================
#  METRICS
# =============================================================================

def compute_metrics(y_true: pd.Series, y_pred: np.ndarray,
                    label: str = "Overall") -> dict:
    if y_true.sum() == 0 and y_pred.sum() == 0:
        return {"label": label, "precision": None, "recall": None,
                "f1": None, "fpr": 0.0, "support": 0,
                "tn": int((y_true == 0).sum()), "fp": 0, "fn": 0, "tp": 0}

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "label":     label,
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall":    float(recall_score(y_true, y_pred, zero_division=0)),
        "f1":        float(f1_score(y_true, y_pred, zero_division=0)),
        "fpr":       float(fpr),
        "support":   int(y_true.sum()),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def fmt(v, decimals=4):
    if v is None:
        return "  N/A  "
    return f"{v:.{decimals}f}"


def print_metrics_table(results: list[dict]):
    header = f"  {'Segment':<26} {'Prec':>7} {'Recall':>7} {'F1':>7} {'FPR':>7} {'TP':>5} {'FP':>5} {'FN':>5}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for r in results:
        print(
            f"  {r['label']:<26} "
            f"{fmt(r['precision']):>7} "
            f"{fmt(r['recall']):>7} "
            f"{fmt(r['f1']):>7} "
            f"{fmt(r['fpr']):>7} "
            f"{r['tp']:>5} "
            f"{r['fp']:>5} "
            f"{r['fn']:>5}"
        )


def evaluate_approach(name: str, y_true: pd.Series, y_pred: np.ndarray,
                      sub: pd.Series, n_total_normal: int) -> dict:
    print(f"\n{SEP2}")
    print(f"  HOLDOUT EVALUATION -- {name}")
    print(SEP2)

    results   = [compute_metrics(y_true, y_pred, "Overall (abusive vs. normal)")]
    pat_results = {}

    for pat in ["card_testing", "scraper", "promo_abuse"]:
        mask = sub == pat
        if mask.sum() == 0:
            continue
        r = compute_metrics(y_true[mask], y_pred[mask], f"  sub: {pat}")
        results.append(r)
        pat_results[pat] = r

    for grp, lbl in [("normal", "  normals"), ("power_user", "  power_users")]:
        mask = sub == grp
        if mask.sum() > 0:
            r = compute_metrics(y_true[mask], y_pred[mask], lbl)
            results.append(r)

    print_metrics_table(results)

    ov = results[0]
    print(f"\n  Confusion matrix:")
    print(f"    True Negative  (correct pass)    : {ov['tn']:>4}")
    print(f"    False Positive (normal flagged)  : {ov['fp']:>4}")
    print(f"    False Negative (abuse missed)    : {ov['fn']:>4}")
    print(f"    True Positive  (abuse caught)    : {ov['tp']:>4}")

    # False-positive cost in plain language
    fp_count = ov["fp"]
    fp_rate  = fp_count / n_total_normal if n_total_normal > 0 else 0.0
    print(f"\n  False-Positive Cost:")
    print(f"    {fp_count} out of {n_total_normal} normal sessions incorrectly flagged")
    print(f"    ({fp_rate*100:.2f}% of all normal sessions = {fp_count} real customers disrupted)")

    return {"summary": ov, "per_pattern": pat_results, "results_list": results,
            "fp_count": fp_count, "n_normal": n_total_normal, "fp_rate": fp_rate}


# =============================================================================
#  HYBRID BREAKDOWN
# =============================================================================

def evaluate_hybrid(y_true: pd.Series, rule_flags: np.ndarray,
                    ml_flags: np.ndarray, sub: pd.Series,
                    n_total_normal: int) -> dict:

    high_conf   = (rule_flags == 1) & (ml_flags == 1)   # AND gate
    review_q    = ((rule_flags == 1) | (ml_flags == 1)) & ~high_conf
    passed      = ~high_conf & ~review_q

    # For binary metrics: anything flagged by either tier = positive
    hybrid_preds_union = (rule_flags | ml_flags).astype(int)

    print(f"\n{SEP2}")
    print("  HOLDOUT EVALUATION -- HYBRID (tiered)")
    print(SEP2)

    total = len(y_true)
    print(f"\n  Tier distribution ({total} sessions):")
    print(f"    high_confidence_flag (RULE AND ML)  : {high_conf.sum():>4}  ({high_conf.sum()/total*100:.1f}%)")
    print(f"    review_queue_flag    (RULE OR ML)   : {review_q.sum():>4}  ({review_q.sum()/total*100:.1f}%)")
    print(f"    pass                 (neither)      : {passed.sum():>4}  ({passed.sum()/total*100:.1f}%)")

    # True positives per tier
    print(f"\n  Abusive sessions per tier:")
    print(f"    high_conf  -> abusive: {y_true[high_conf].sum():<4}  normal: {(y_true[high_conf]==0).sum()}")
    print(f"    review_q   -> abusive: {y_true[review_q].sum():<4}  normal: {(y_true[review_q]==0).sum()}")
    print(f"    pass       -> abusive: {y_true[passed].sum():<4}  normal: {(y_true[passed]==0).sum()}")

    print(f"\n  Metrics (treating either tier as 'flagged'):")
    results = [compute_metrics(y_true, hybrid_preds_union, "Overall (union)")]
    for pat in ["card_testing", "scraper", "promo_abuse"]:
        mask = sub == pat
        if mask.sum() == 0:
            continue
        results.append(compute_metrics(y_true[mask], hybrid_preds_union[mask], f"  sub: {pat}"))
    for grp, lbl in [("normal", "  normals"), ("power_user", "  power_users")]:
        mask = sub == grp
        if mask.sum() > 0:
            results.append(compute_metrics(y_true[mask], hybrid_preds_union[mask], lbl))

    print_metrics_table(results)

    ov = results[0]
    fp_count = ov["fp"]
    fp_rate  = fp_count / n_total_normal if n_total_normal > 0 else 0.0
    print(f"\n  False-Positive Cost (union):")
    print(f"    {fp_count} out of {n_total_normal} normal sessions incorrectly flagged")
    print(f"    ({fp_rate*100:.2f}% of all normal sessions)")

    return {
        "summary": ov,
        "per_pattern": {},
        "results_list": results,
        "tiers": {
            "high_confidence_count": int(high_conf.sum()),
            "review_queue_count":    int(review_q.sum()),
            "pass_count":            int(passed.sum()),
            "high_conf_abusive":     int(y_true[high_conf].sum()),
            "high_conf_normal":      int((y_true[high_conf] == 0).sum()),
            "review_q_abusive":      int(y_true[review_q].sum()),
            "review_q_normal":       int((y_true[review_q] == 0).sum()),
            "pass_abusive":          int(y_true[passed].sum()),
            "pass_normal":           int((y_true[passed] == 0).sum()),
        },
        "fp_count": fp_count,
        "n_normal": n_total_normal,
        "fp_rate":  fp_rate,
    }


# =============================================================================
#  MAIN
# =============================================================================

def main():
    print(f"\n{SEP2}")
    print("  AGENT-ABUSE SENTINEL -- FINAL HOLDOUT EVALUATION")
    print("  (This is the one and only time sessions_holdout.csv is read)")
    print(SEP2)

    # -------------------------------------------------------------------------
    # Load models
    # -------------------------------------------------------------------------
    with open(MODELS_DIR / "rule_thresholds.json") as f:
        thresholds = json.load(f)

    with open(MODELS_DIR / "lgbm_model.pkl", "rb") as f:
        ml_bundle = pickle.load(f)
    ml_model   = ml_bundle["model"]
    ml_thresh  = ml_bundle["prob_threshold"]
    feat_cols  = ml_bundle["feature_cols"]
    ml_name    = ml_bundle["model_name"]

    print(f"[OK] Loaded rule thresholds  (flag_score_threshold={thresholds['flag_score_threshold']})")
    print(f"[OK] Loaded ML model         ({ml_name}, prob_threshold={ml_thresh})")
    print(f"[OK] Feature columns         ({len(feat_cols)} features)")
    print()

    # -------------------------------------------------------------------------
    # Load holdout -- FIRST AND ONLY TIME
    # -------------------------------------------------------------------------
    df = pd.read_csv(HOLDOUT_PATH)
    print(f"[OK] Loaded {HOLDOUT_PATH}  shape={df.shape}")

    y_true      = (df["label"] == "abusive").astype(int)
    sub_pattern = df["sub_pattern"].copy()

    drop_cols = ["session_id", "label", "sub_pattern"]
    X_raw     = df.drop(columns=drop_cols)
    X         = build_features(X_raw, feat_cols)

    n_total        = len(df)
    n_total_abusive = int(y_true.sum())
    n_total_normal  = int((y_true == 0).sum())

    print(f"     Total rows    : {n_total}")
    print(f"     Abusive       : {n_total_abusive}  ({n_total_abusive/n_total*100:.1f}%)")
    print(f"     Normal        : {n_total_normal}  ({n_total_normal/n_total*100:.1f}%)")
    print(f"     Sub-patterns  : {dict(sub_pattern.value_counts())}")

    # -------------------------------------------------------------------------
    # Score -- NO RETUNING
    # -------------------------------------------------------------------------
    rule_scores  = X.apply(lambda r: rule_score(r, thresholds), axis=1)
    rule_flags   = (rule_scores >= thresholds["flag_score_threshold"]).astype(int).values

    ml_proba     = ml_model.predict_proba(X)[:, 1]
    ml_flags     = (ml_proba >= ml_thresh).astype(int)

    # -------------------------------------------------------------------------
    # Evaluate each approach
    # -------------------------------------------------------------------------
    rule_eval   = evaluate_approach("RULE-BASED SCORER",  y_true, rule_flags,
                                    sub_pattern, n_total_normal)
    ml_eval     = evaluate_approach(f"ML ({ml_name})",    y_true, ml_flags,
                                    sub_pattern, n_total_normal)
    hybrid_eval = evaluate_hybrid(y_true, rule_flags, ml_flags,
                                  sub_pattern, n_total_normal)

    # -------------------------------------------------------------------------
    # Side-by-side summary
    # -------------------------------------------------------------------------
    print(f"\n{SEP2}")
    print("  FINAL HOLDOUT COMPARISON (side-by-side)")
    print(SEP2)

    def ov(ev): return ev["summary"]

    r_r = ov(rule_eval)
    r_m = ov(ml_eval)
    r_h = ov(hybrid_eval)

    col_w = [12, 14, 14, 14]
    hdr   = ["Metric", "Rule-Based", f"ML ({ml_name[:8]}...)", "Hybrid (union)"]
    rows  = [
        ("Precision", fmt(r_r["precision"]), fmt(r_m["precision"]), fmt(r_h["precision"])),
        ("Recall",    fmt(r_r["recall"]),    fmt(r_m["recall"]),    fmt(r_h["recall"])),
        ("F1",        fmt(r_r["f1"]),        fmt(r_m["f1"]),        fmt(r_h["f1"])),
        ("FPR",       fmt(r_r["fpr"]),       fmt(r_m["fpr"]),       fmt(r_h["fpr"])),
        ("FP count",  str(r_r["fp"]),        str(r_m["fp"]),        str(r_h["fp"])),
        ("FN count",  str(r_r["fn"]),        str(r_m["fn"]),        str(r_h["fn"])),
    ]
    print("  " + "  ".join(h.ljust(w) for h, w in zip(hdr, col_w)))
    print("  " + "-" * (sum(col_w) + len(col_w) * 2))
    for row in rows:
        print("  " + "  ".join(str(v).ljust(w) for v, w in zip(row, col_w)))

    print(f"\n  Sub-pattern recall (holdout):")
    sub_hdr = f"  {'Sub-pattern':<20} {'Rule':>8} {'ML':>8} {'Hybrid':>8}"
    print(sub_hdr)
    print("  " + "-" * 46)
    for pat in ["card_testing", "scraper", "promo_abuse"]:
        rr = rule_eval["per_pattern"].get(pat, {}).get("recall")
        mr = ml_eval["per_pattern"].get(pat, {}).get("recall")
        hr_list = [r for r in hybrid_eval["results_list"] if r["label"] == f"  sub: {pat}"]
        hr = hr_list[0]["recall"] if hr_list else None
        print(f"  {pat:<20} {fmt(rr):>8} {fmt(mr):>8} {fmt(hr):>8}")

    print(f"\n  False-positive cost (plain count):")
    print(f"    Rule-Based  : {r_r['fp']:>3} out of {n_total_normal} normal sessions flagged")
    print(f"    ML          : {r_m['fp']:>3} out of {n_total_normal} normal sessions flagged")
    print(f"    Hybrid(OR)  : {r_h['fp']:>3} out of {n_total_normal} normal sessions flagged")

    # -------------------------------------------------------------------------
    # Honesty check
    # -------------------------------------------------------------------------
    print(f"\n{SEP}")
    print("  HONESTY CHECK")
    print(SEP)
    perfect = all(
        r["f1"] is not None and r["f1"] >= 0.999
        for r in [r_r, r_m, r_h]
    )
    if perfect:
        print("  *** RESULTS LOOK SUSPICIOUSLY PERFECT (F1=1.0 for all approaches) ***")
        print()
        print("  This is worth flagging honestly:")
        print("  - The data is SYNTHETIC and was generated from the same distributions")
        print("    that the thresholds/model were trained on.")
        print("  - The holdout is a held-out SPLIT of that synthetic dataset, not real")
        print("    production traffic. The generating process guarantees separation.")
        print("  - In real deployments, adversarial actors would adapt, add noise,")
        print("    and deliberately blend features to evade these detectors.")
        print("  - These scores are valid for validating pipeline correctness and")
        print("    that the decision boundaries generalised within this distribution.")
        print("  - They should NOT be interpreted as 'this will score 1.0 on real data'.")
    else:
        print("  Results are NOT perfect -- see per-approach metrics above for gaps.")
        if r_r["fn"] > 0:
            print(f"  Rule-based missed {r_r['fn']} abusive sessions (false negatives).")
        if r_m["fn"] > 0:
            print(f"  ML missed {r_m['fn']} abusive sessions (false negatives).")
        if r_r["fp"] > 0 or r_m["fp"] > 0:
            print(f"  False positives detected -- see 'False-Positive Cost' above.")

    # -------------------------------------------------------------------------
    # Save JSON report
    # -------------------------------------------------------------------------
    def serialise(ev, name):
        s = ev["summary"]
        return {
            "approach":          name,
            "precision":         s["precision"],
            "recall":            s["recall"],
            "f1":                s["f1"],
            "fpr":               s["fpr"],
            "tp":                s["tp"],
            "fp":                s["fp"],
            "fn":                s["fn"],
            "tn":                s["tn"],
            "fp_count":          ev["fp_count"],
            "n_normal":          ev["n_normal"],
            "fp_rate":           ev["fp_rate"],
            "per_pattern": {
                pat: {
                    "precision": r["precision"],
                    "recall":    r["recall"],
                    "f1":        r["f1"],
                    "tp":        r["tp"],
                    "fp":        r["fp"],
                    "fn":        r["fn"],
                }
                for pat, r in ev.get("per_pattern", {}).items()
            },
        }

    report = {
        "holdout_path":        HOLDOUT_PATH,
        "holdout_total":       n_total,
        "holdout_abusive":     n_total_abusive,
        "holdout_normal":      n_total_normal,
        "rule_score_threshold": thresholds["flag_score_threshold"],
        "ml_prob_threshold":   ml_thresh,
        "ml_model":            ml_name,
        "results_are_perfect": perfect,
        "honesty_note": (
            "Perfect scores are expected from synthetic held-out data sharing the "
            "same generating distribution. Not indicative of real-world performance."
        ) if perfect else "Results contain imperfections -- see per-approach metrics.",
        "rule_based":  serialise(rule_eval,   "Rule-Based Scorer"),
        "ml":          serialise(ml_eval,     f"ML ({ml_name})"),
        "hybrid": {
            **serialise(hybrid_eval, "Hybrid (union)"),
            "tiers": hybrid_eval["tiers"],
        },
    }

    report_path = pathlib.Path("evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  [SAVED] {report_path}")
    print(f"\n{SEP2}\n")


if __name__ == "__main__":
    main()
