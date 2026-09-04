"""
Agent-Abuse Sentinel -- Inference & Explainability Layer
==========================================================
Turns the trained rule-scorer + LightGBM model into a callable service that
returns one clean, UI-ready JSON object per session:

  - tier: "pass" | "review_queue" | "high_confidence"
  - rule_score, rule_max, rule_threshold
  - ml_probability, ml_threshold  (null if lightgbm isn't installed)
  - signals: list of human-readable reasons the rule scorer fired/didn't
  - top_model_features: model's globally most important features + this
    session's value for each, for a lightweight "what the model looked at"
    explanation panel (not a true per-row SHAP value, labelled as such)

Two entry points:
  score_session(session: dict) -> dict          # one session, e.g. from an API
  score_batch(csv_path: str)   -> list[dict]     # many sessions, e.g. holdout

Also runnable as a CLI:
  python score_session.py --sample 8            # 8 sample sessions -> JSON
  python score_session.py --session-id <uuid>    # one row from holdout
  python score_session.py --csv sessions_holdout.csv --out demo_fixtures.json
"""

import sys, io
if sys.platform == "win32" and getattr(sys.stdout, "encoding", "").lower() != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    except Exception:
        pass

import json
import pickle
import pathlib
import argparse
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

MODELS_DIR   = pathlib.Path(__file__).parent / "models"
RULE_PATH    = MODELS_DIR / "rule_thresholds.json"
ML_PATH      = MODELS_DIR / "lgbm_model.pkl"
FEAT_PATH    = MODELS_DIR / "feature_columns.json"

RAW_FEATURE_COLS = [
    "num_requests", "session_duration_sec", "mean_inter_request_time",
    "std_inter_request_time", "min_inter_request_time", "unique_params_touched",
    "param_reuse_rate", "failed_request_rate", "endpoint_diversity",
    "user_agent_entropy", "mouse_or_client_signal_present",
    "discount_code_attempts", "geo_ip_consistency", "time_of_day_bucket",
]

# Human-readable labels + direction for each rule condition. Order matches
# the scoring logic in train_sentinel.py / evaluate_holdout.py exactly.
RULE_CONDITIONS = [
    ("param_reuse_rate",              "gt", "param_reuse_rate_gt",
     "High parameter reuse ({val:.2f} > {thr:.2f}) -- same values sent repeatedly"),
    ("num_requests",                  "gt", "num_requests_gt",
     "Unusually high request volume ({val:.0f} > {thr:.0f})"),
    ("mean_inter_request_time",       "lt", "mean_inter_request_time_lt",
     "Requests fired too fast on average ({val:.2f}s < {thr:.2f}s)"),
    ("std_inter_request_time",        "lt", "std_inter_request_time_lt",
     "Machine-regular timing, low variance ({val:.2f}s < {thr:.2f}s)"),
    ("min_inter_request_time",        "lt", "min_inter_request_time_lt",
     "Fastest gap between requests is too short ({val:.2f}s < {thr:.2f}s)"),
    ("failed_request_rate",           "gt", "failed_request_rate_gt",
     "High failure rate ({val:.0%} > {thr:.0%}) -- consistent with probing/testing"),
    ("unique_params_touched",         "gt", "unique_params_touched_gt",
     "Touches an unusually wide range of params ({val:.0f} > {thr:.0f}) -- scanning behaviour"),
    ("discount_code_attempts",        "gt", "discount_code_attempts_gt",
     "Excessive discount code attempts ({val:.0f} > {thr:.0f})"),
]


# =============================================================================
#  LOAD ARTIFACTS (once, at import time)
# =============================================================================

def _load_artifacts():
    with open(RULE_PATH) as f:
        thresholds = json.load(f)
    with open(FEAT_PATH) as f:
        feature_cols = json.load(f)

    ml_model = None
    ml_name = None
    ml_thresh = None
    ml_error = None
    try:
        with open(ML_PATH, "rb") as f:
            bundle = pickle.load(f)
        ml_model  = bundle["model"]
        ml_name   = bundle["model_name"]
        ml_thresh = bundle["prob_threshold"]
    except ModuleNotFoundError as e:
        # e.g. lightgbm not installed in this environment
        ml_error = f"ML model unavailable ({e}); falling back to rule-only scoring"
    except Exception as e:
        ml_error = f"ML model failed to load ({e}); falling back to rule-only scoring"

    return thresholds, feature_cols, ml_model, ml_name, ml_thresh, ml_error


THRESHOLDS, FEATURE_COLS, ML_MODEL, ML_NAME, ML_THRESH, ML_LOAD_ERROR = _load_artifacts()


# =============================================================================
#  FEATURE ENGINEERING (must match train_sentinel.py exactly)
# =============================================================================

def _build_feature_row(session: dict) -> pd.DataFrame:
    row = {col: session[col] for col in RAW_FEATURE_COLS}
    df = pd.DataFrame([row])
    for col in ["mouse_or_client_signal_present", "geo_ip_consistency"]:
        df[col] = df[col].astype(int)
    df = pd.get_dummies(df, columns=["time_of_day_bucket"], drop_first=False)
    df = df.reindex(columns=FEATURE_COLS, fill_value=0)
    return df


# =============================================================================
#  RULE SCORING WITH EXPLANATIONS
# =============================================================================

def _rule_score_explained(session: dict, thresholds: dict):
    signals = []
    score = 0

    for feat, direction, thr_key, template in RULE_CONDITIONS:
        val = session[feat]
        thr = thresholds[thr_key]
        fired = (val > thr) if direction == "gt" else (val < thr)
        if fired:
            score += 1
        signals.append({
            "feature":   feat,
            "value":     val,
            "threshold": round(thr, 4),
            "direction": direction,
            "fired":     bool(fired),
            "reason":    template.format(val=val, thr=thr) if fired else None,
        })

    # Boolean penalty: absence of mouse/client signal
    mouse_absent = not bool(session["mouse_or_client_signal_present"])
    if mouse_absent:
        score += thresholds["mouse_signal_absent_penalty"]
    signals.append({
        "feature":   "mouse_or_client_signal_present",
        "value":     session["mouse_or_client_signal_present"],
        "threshold": None,
        "direction": "absent_penalty",
        "fired":     mouse_absent,
        "reason":    "No mouse/client-side interaction signal present" if mouse_absent else None,
    })

    return score, signals


# =============================================================================
#  MODEL-LEVEL EXPLANATION (global feature importance, not per-row SHAP)
# =============================================================================

def _top_model_features(session: dict, n: int = 5):
    if ML_MODEL is None or not hasattr(ML_MODEL, "feature_importances_"):
        return None
    importances = pd.Series(ML_MODEL.feature_importances_, index=FEATURE_COLS)
    top = importances.sort_values(ascending=False).head(n)
    out = []
    for feat, imp in top.items():
        val = session.get(feat)
        if val is None and feat.startswith("time_of_day_bucket_"):
            val = (session.get("time_of_day_bucket") == feat.replace("time_of_day_bucket_", ""))
        out.append({
            "feature": feat,
            "importance": round(float(imp), 4),
            "session_value": val,
        })
    return out


# =============================================================================
#  MAIN SCORING FUNCTION
# =============================================================================

def score_session(session: dict) -> dict:
    """
    Score one session. `session` must contain all RAW_FEATURE_COLS keys
    (session_id / label / sub_pattern are optional passthrough metadata).
    Returns a UI-ready dict -- safe to json.dumps() directly.
    """
    missing = [c for c in RAW_FEATURE_COLS if c not in session]
    if missing:
        raise ValueError(f"session is missing required fields: {missing}")

    rule_score, signals = _rule_score_explained(session, THRESHOLDS)
    rule_threshold = THRESHOLDS["flag_score_threshold"]
    rule_flag = rule_score >= rule_threshold

    ml_probability = None
    ml_flag = None
    if ML_MODEL is not None:
        X = _build_feature_row(session)
        ml_probability = float(ML_MODEL.predict_proba(X)[:, 1][0])
        ml_flag = ml_probability >= ML_THRESH

    # Tier logic identical to evaluate_holdout.py's hybrid (AND = high conf,
    # OR-only = review queue). If ML is unavailable, fall back to rule-only.
    if ml_flag is None:
        tier = "review_queue" if rule_flag else "pass"
    elif rule_flag and ml_flag:
        tier = "high_confidence"
    elif rule_flag or ml_flag:
        tier = "review_queue"
    else:
        tier = "pass"

    fired_signals = [s for s in signals if s["fired"]]

    result = {
        "session_id":        session.get("session_id"),
        "true_label":        session.get("label"),        # None for live/unlabeled input
        "true_sub_pattern":  session.get("sub_pattern"),   # None for live/unlabeled input
        "tier":              tier,
        "rule": {
            "score":     rule_score,
            "max_score": 9,
            "threshold": rule_threshold,
            "flagged":   rule_flag,
        },
        "ml": {
            "model":       ML_NAME,
            "probability": round(ml_probability, 4) if ml_probability is not None else None,
            "threshold":   ML_THRESH,
            "flagged":     ml_flag,
            "unavailable_reason": ML_LOAD_ERROR if ML_MODEL is None else None,
        },
        "signals_fired":     fired_signals,
        "signals_all":       signals,
        "top_model_features": _top_model_features(session),
    }
    return result


def score_batch(csv_path: str) -> list:
    df = pd.read_csv(csv_path)
    results = []
    for _, row in df.iterrows():
        results.append(score_session(row.to_dict()))
    return results


# =============================================================================
#  CLI
# =============================================================================

def _summarize_for_stitch(results: list) -> dict:
    """Small aggregate block -- handy for a dashboard header in the UI."""
    total = len(results)
    tiers = {"pass": 0, "review_queue": 0, "high_confidence": 0}
    for r in results:
        tiers[r["tier"]] += 1
    return {"total_sessions": total, "tier_counts": tiers}


def main():
    ap = argparse.ArgumentParser(description="Score sessions with explanations")
    ap.add_argument("--csv", default="sessions_holdout.csv", help="CSV to score")
    ap.add_argument("--session-id", help="Score just this one session_id from --csv")
    ap.add_argument("--sample", type=int, help="Score N random rows from --csv (mixed labels)")
    ap.add_argument("--out", help="Write JSON output to this file instead of stdout")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)

    if args.session_id:
        row = df[df["session_id"] == args.session_id]
        if row.empty:
            print(f"session_id {args.session_id} not found in {args.csv}", file=sys.stderr)
            sys.exit(1)
        results = [score_session(row.iloc[0].to_dict())]
    elif args.sample:
        # Stratified sampling across normal profiles and abusive sub-patterns
        sub_pats = df["sub_pattern"].unique()
        n_each = max(1, args.sample // len(sub_pats))
        parts = []
        for pat in sub_pats:
            subset = df[df["sub_pattern"] == pat]
            if not subset.empty:
                parts.append(subset.sample(n=min(n_each, len(subset)), random_state=42))
        sample_df = pd.concat(parts).sample(frac=1, random_state=42).reset_index(drop=True)
        if len(sample_df) < args.sample:
            rem = args.sample - len(sample_df)
            extra = df[~df["session_id"].isin(sample_df["session_id"])].sample(n=min(rem, len(df)), random_state=42)
            sample_df = pd.concat([sample_df, extra]).reset_index(drop=True)
        results = [score_session(r.to_dict()) for _, r in sample_df.iterrows()]
    else:
        results = score_batch(args.csv)

    output = {"results": results, "summary": _summarize_for_stitch(results)}

    if ML_LOAD_ERROR:
        print(f"[WARN] {ML_LOAD_ERROR}", file=sys.stderr)

    text = json.dumps(output, indent=2, default=str)
    if args.out:
        pathlib.Path(args.out).write_text(text)
        print(f"[OK] Wrote {len(results)} scored session(s) to {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
