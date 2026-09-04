"""
Agent-Abuse Sentinel — Detector Training
=========================================
Trains TWO detectors on sessions_train.csv ONLY.
  1. Deterministic Rule-Based Scorer (fully explainable)
  2. LightGBM ML Classifier (gradient-boosted tree)

Internal 80/20 val split used for threshold tuning & reporting.
Holdout (sessions_holdout.csv) is NEVER loaded or referenced here.

Outputs:
  models/rule_thresholds.json   -- rule-based config
  models/lgbm_model.pkl         -- pickled ML model
  models/feature_columns.json   -- ordered feature list for inference
"""

import sys, io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import json
import pickle
import warnings
import pathlib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score, confusion_matrix
)
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

SEED = 42
np.random.seed(SEED)

MODELS_DIR = pathlib.Path("models")
MODELS_DIR.mkdir(exist_ok=True)

SEP  = "-" * 72
SEP2 = "=" * 72

# =============================================================================
#  1. LOAD & SPLIT
# =============================================================================

def load_data(path: str = "sessions_train.csv"):
    df = pd.read_csv(path)
    assert "sessions_holdout" not in path, "DO NOT load holdout!"
    print(f"[OK] Loaded {path}  shape={df.shape}")

    # Separate target — never let it into feature matrix
    y_label     = (df["label"] == "abusive").astype(int)   # 1=abusive, 0=normal
    sub_pattern = df["sub_pattern"].copy()                  # for per-class breakdown
    session_id  = df["session_id"].copy()

    # Drop columns that must not be features
    drop_cols = ["session_id", "label", "sub_pattern"]
    X_raw = df.drop(columns=drop_cols)
    return X_raw, y_label, sub_pattern, session_id


def build_features(X_raw: pd.DataFrame) -> pd.DataFrame:
    """One-hot encode time_of_day_bucket; cast booleans to int."""
    X = X_raw.copy()

    # Cast booleans to int
    for col in ["mouse_or_client_signal_present", "geo_ip_consistency"]:
        X[col] = X[col].astype(int)

    # One-hot encode the single categorical
    X = pd.get_dummies(X, columns=["time_of_day_bucket"], drop_first=False)

    return X


# =============================================================================
#  2. RULE-BASED SCORER
# =============================================================================

def derive_rule_thresholds(X_train: pd.DataFrame, y_train: pd.Series) -> dict:
    """
    For each key numeric feature, find the value that best separates classes
    on the TRAINING split only (simple midpoint between class medians).
    Returns a dict of thresholds used by the scorer.
    """
    df_t = X_train.copy()
    df_t["__y"] = y_train.values

    def midpoint(col):
        m_abus  = df_t.loc[df_t["__y"] == 1, col].median()
        m_norm  = df_t.loc[df_t["__y"] == 0, col].median()
        return round(float((m_abus + m_norm) / 2), 6)

    thresholds = {
        # High-signal features — direction noted
        "param_reuse_rate_gt":          midpoint("param_reuse_rate"),
        "num_requests_gt":              midpoint("num_requests"),
        "mean_inter_request_time_lt":   midpoint("mean_inter_request_time"),
        "std_inter_request_time_lt":    midpoint("std_inter_request_time"),
        "min_inter_request_time_lt":    midpoint("min_inter_request_time"),
        "failed_request_rate_gt":       midpoint("failed_request_rate"),
        "unique_params_touched_gt":     midpoint("unique_params_touched"),
        "discount_code_attempts_gt":    midpoint("discount_code_attempts"),
        # Boolean features (treated as 0/1): penalise absence of mouse signal
        "mouse_signal_absent_penalty":  1,   # +1 score point when mouse absent
    }
    return thresholds


def rule_score(row: pd.Series, thresholds: dict) -> int:
    """
    Assign a score in [0..8] based on how many rule conditions fire.
    Returns raw score — caller decides the flag threshold.
    """
    t  = thresholds
    s  = 0
    s += int(row["param_reuse_rate"]          >  t["param_reuse_rate_gt"])
    s += int(row["num_requests"]               >  t["num_requests_gt"])
    s += int(row["mean_inter_request_time"]    <  t["mean_inter_request_time_lt"])
    s += int(row["std_inter_request_time"]     <  t["std_inter_request_time_lt"])
    s += int(row["min_inter_request_time"]     <  t["min_inter_request_time_lt"])
    s += int(row["failed_request_rate"]        >  t["failed_request_rate_gt"])
    s += int(row["unique_params_touched"]      >  t["unique_params_touched_gt"])
    s += int(row["discount_code_attempts"]     >  t["discount_code_attempts_gt"])
    s += int(row["mouse_or_client_signal_present"] == 0) * t["mouse_signal_absent_penalty"]
    return s


def tune_rule_threshold(X_val: pd.DataFrame, y_val: pd.Series,
                        thresholds: dict) -> int:
    """Sweep score thresholds 1..9 on val set; pick the one maximising F1."""
    scores = X_val.apply(lambda r: rule_score(r, thresholds), axis=1)
    best_t, best_f1 = 1, 0.0
    for t in range(1, 10):
        preds = (scores >= t).astype(int)
        f1 = f1_score(y_val, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_t  = t
    return best_t


# =============================================================================
#  3. ML CLASSIFIER (LightGBM)
# =============================================================================

def train_lgbm(X_train: pd.DataFrame, y_train: pd.Series,
               X_val: pd.DataFrame,   y_val: pd.Series):
    try:
        import lightgbm as lgb
        USE_LGBM = True
    except ImportError:
        USE_LGBM = False

    if USE_LGBM:
        scale_pos = float((y_train == 0).sum()) / float((y_train == 1).sum())
        model = lgb.LGBMClassifier(
            n_estimators       = 300,
            learning_rate      = 0.05,
            num_leaves         = 15,
            max_depth          = 5,
            min_child_samples  = 5,
            scale_pos_weight   = scale_pos,
            random_state       = SEED,
            verbose            = -1,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(30, verbose=False),
                       lgb.log_evaluation(period=-1)],
        )
        model_name = "LightGBM"
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        model = GradientBoostingClassifier(
            n_estimators  = 200,
            learning_rate = 0.05,
            max_depth     = 3,
            subsample     = 0.8,
            random_state  = SEED,
        )
        model.fit(X_train, y_train)
        model_name = "GradientBoostingClassifier (sklearn fallback)"

    return model, model_name


def tune_ml_threshold(model, X_val: pd.DataFrame, y_val: pd.Series) -> float:
    """Sweep probability thresholds 0.1..0.9 on val; pick best F1."""
    proba = model.predict_proba(X_val)[:, 1]
    best_t, best_f1 = 0.5, 0.0
    for t in np.arange(0.10, 0.91, 0.02):
        preds = (proba >= t).astype(int)
        f1 = f1_score(y_val, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_t  = t
    return round(float(best_t), 4)


# =============================================================================
#  4. METRICS REPORTING
# =============================================================================

def compute_metrics(y_true: pd.Series, y_pred: np.ndarray,
                    label: str = "Overall") -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    return {
        "label":     label,
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall":    recall_score(y_true, y_pred, zero_division=0),
        "f1":        f1_score(y_true, y_pred, zero_division=0),
        "fpr":       fpr,
        "support":   int(y_true.sum()),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def metrics_table(results: list[dict]) -> str:
    header = f"{'Segment':<22} {'Prec':>7} {'Recall':>7} {'F1':>7} {'FPR':>7} {'Supp':>6}"
    lines  = [header, "-" * len(header)]
    for r in results:
        lines.append(
            f"{r['label']:<22} "
            f"{r['precision']:>7.4f} "
            f"{r['recall']:>7.4f} "
            f"{r['f1']:>7.4f} "
            f"{r['fpr']:>7.4f} "
            f"{r['support']:>6}"
        )
    return "\n".join(lines)


def evaluate_approach(name: str, y_val: pd.Series, y_pred: np.ndarray,
                      sub_val: pd.Series):
    """Print overall + per-subpattern metrics for one approach."""
    print(f"\n{SEP2}")
    print(f"  APPROACH: {name}")
    print(SEP2)

    results = [compute_metrics(y_val, y_pred, "Overall (abusive)")]

    # Per sub-pattern — only abusive sub-patterns matter here
    abusive_pats = ["card_testing", "scraper", "promo_abuse"]
    for pat in abusive_pats:
        mask = sub_val == pat
        if mask.sum() == 0:
            continue
        results.append(compute_metrics(y_val[mask], y_pred[mask], f"  sub: {pat}"))

    # False-positive rate on normals
    mask_norm  = (sub_val == "normal") | (sub_val == "power_user")
    if mask_norm.sum() > 0:
        r_norm = compute_metrics(y_val[mask_norm], y_pred[mask_norm], "  normals (FP pool)")
        results.append(r_norm)

    print(metrics_table(results))

    # Confusion matrix
    ov = results[0]
    print(f"\n  Confusion matrix (val split):")
    print(f"    True Negative  (correct normal) : {ov['tn']:>4}")
    print(f"    False Positive (normal->abusive): {ov['fp']:>4}")
    print(f"    False Negative (missed abuse)   : {ov['fn']:>4}")
    print(f"    True Positive  (caught abuse)   : {ov['tp']:>4}")

    return results


# =============================================================================
#  5. MAIN
# =============================================================================

def main():
    print(f"\n{SEP2}")
    print("  AGENT-ABUSE SENTINEL -- DETECTOR TRAINING")
    print(SEP2)

    # -------------------------------------------------------------------------
    # Load
    X_raw, y, sub_pattern, _ = load_data("sessions_train.csv")
    X = build_features(X_raw)
    feature_cols = list(X.columns)
    print(f"[OK] Feature matrix shape: {X.shape}")
    print(f"[OK] Class balance  -- normal: {(y==0).sum()}  abusive: {(y==1).sum()}")

    # -------------------------------------------------------------------------
    # Internal 80/20 stratified split (still within train — holdout untouched)
    X_tr, X_val, y_tr, y_val, sub_tr, sub_val = train_test_split(
        X, y, sub_pattern,
        test_size    = 0.20,
        random_state = SEED,
        stratify     = y,
    )
    print(f"\n[OK] Internal split -- train: {len(X_tr)}  val: {len(X_val)}")
    print(f"     Val abusive: {y_val.sum()}  Val normal: {(y_val==0).sum()}")

    # =========================================================================
    # APPROACH A: RULE-BASED
    # =========================================================================
    print(f"\n{SEP}")
    print("  [A] DERIVING RULE-BASED THRESHOLDS from internal train split ...")
    print(SEP)

    thresholds = derive_rule_thresholds(X_tr, y_tr)

    print("  Derived midpoint thresholds:")
    for k, v in thresholds.items():
        if k != "mouse_signal_absent_penalty":
            print(f"    {k:<42} : {v}")

    # Tune score cut-off on val
    best_score_thresh = tune_rule_threshold(X_val, y_val, thresholds)
    thresholds["flag_score_threshold"] = best_score_thresh
    print(f"\n  >> Best rule score threshold (max-F1 on val): {best_score_thresh}")

    # Predict
    rule_scores = X_val.apply(lambda r: rule_score(r, thresholds), axis=1)
    rule_preds  = (rule_scores >= best_score_thresh).astype(int).values

    rule_results = evaluate_approach("RULE-BASED SCORER", y_val, rule_preds, sub_val)

    # Save rule config
    rule_path = MODELS_DIR / "rule_thresholds.json"
    with open(rule_path, "w") as f:
        json.dump(thresholds, f, indent=2)
    print(f"\n  [SAVED] {rule_path}")

    # =========================================================================
    # APPROACH B: ML (LightGBM / sklearn GBT fallback)
    # =========================================================================
    print(f"\n{SEP}")
    print("  [B] TRAINING ML CLASSIFIER ...")
    print(SEP)

    ml_model, ml_name = train_lgbm(X_tr, y_tr, X_val, y_val)
    print(f"  Model: {ml_name}")

    ml_thresh = tune_ml_threshold(ml_model, X_val, y_val)
    proba_val = ml_model.predict_proba(X_val)[:, 1]
    ml_preds  = (proba_val >= ml_thresh).astype(int)
    print(f"  >> Best ML probability threshold (max-F1 on val): {ml_thresh}")

    ml_results = evaluate_approach(f"ML ({ml_name})", y_val, ml_preds, sub_val)

    # Feature importance (top 10)
    if hasattr(ml_model, "feature_importances_"):
        fi = pd.Series(ml_model.feature_importances_, index=feature_cols)
        fi = fi.sort_values(ascending=False).head(10)
        print(f"\n  Top-10 feature importances:")
        for feat, imp in fi.items():
            bar = "#" * int(imp / fi.max() * 30)
            print(f"    {feat:<40} {imp:.4f}  {bar}")

    # Save ML model + metadata
    ml_path = MODELS_DIR / "lgbm_model.pkl"
    with open(ml_path, "wb") as f:
        pickle.dump({
            "model":            ml_model,
            "model_name":       ml_name,
            "feature_cols":     feature_cols,
            "prob_threshold":   ml_thresh,
        }, f)
    print(f"\n  [SAVED] {ml_path}")

    feat_path = MODELS_DIR / "feature_columns.json"
    with open(feat_path, "w") as f:
        json.dump(feature_cols, f, indent=2)
    print(f"  [SAVED] {feat_path}")

    # =========================================================================
    # SIDE-BY-SIDE COMPARISON SUMMARY
    # =========================================================================
    print(f"\n{SEP2}")
    print("  SIDE-BY-SIDE COMPARISON (internal validation split)")
    print(SEP2)

    def ov(results):
        return next(r for r in results if r["label"] == "Overall (abusive)")

    r_rule = ov(rule_results)
    r_ml   = ov(ml_results)

    rows = [
        ("Metric",    "Rule-Based",             "ML Classifier"),
        ("Precision", f"{r_rule['precision']:.4f}", f"{r_ml['precision']:.4f}"),
        ("Recall",    f"{r_rule['recall']:.4f}",    f"{r_ml['recall']:.4f}"),
        ("F1",        f"{r_rule['f1']:.4f}",         f"{r_ml['f1']:.4f}"),
        ("FPR",       f"{r_rule['fpr']:.4f}",        f"{r_ml['fpr']:.4f}"),
    ]
    col_w = [14, 16, 16]
    print("  " + "  ".join(h.ljust(w) for h, w in zip(rows[0], col_w)))
    print("  " + "-" * sum(col_w + [4]))
    for row in rows[1:]:
        print("  " + "  ".join(v.ljust(w) for v, w in zip(row, col_w)))

    print(f"\n  Sub-pattern recall breakdown:")
    abusive_pats = ["card_testing", "scraper", "promo_abuse"]
    hdr = f"  {'Sub-pattern':<20} {'Rule Recall':>12} {'ML Recall':>12}"
    print(hdr)
    print("  " + "-" * 46)
    for pat in abusive_pats:
        lbl = f"  sub: {pat}"
        r_r = next((r for r in rule_results if r["label"] == lbl), None)
        r_m = next((r for r in ml_results   if r["label"] == lbl), None)
        rr  = f"{r_r['recall']:.4f}" if r_r else "  N/A "
        mr  = f"{r_m['recall']:.4f}" if r_m else "  N/A "
        print(f"  {pat:<20} {rr:>12} {mr:>12}")

    print(f"\n{SEP2}")
    print("  NEXT STEPS")
    print(SEP2)
    print("  - Review the comparison above and decide: rule-only / ML-only / hybrid.")
    print("  - Hybrid option: flag as abusive if EITHER score fires (high recall)")
    print("    or BOTH fire (high precision).")
    print("  - Holdout (sessions_holdout.csv) stays LOCKED until final evaluation.")
    print(f"{SEP2}\n")


if __name__ == "__main__":
    main()
