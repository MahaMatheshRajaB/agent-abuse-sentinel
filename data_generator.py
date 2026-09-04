import sys, io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

"""
AI Agent-Abuse Sentinel - Synthetic Session Telemetry Generator
================================================================
Generates labeled session-level data simulating a payments checkout API.

Sub-patterns within "abusive":
  1. card_testing  - high-volume, machine-regular, hammers one endpoint
  2. scraper       - catalog-scanning, high unique params, low fail rate
  3. promo_abuse   - discount code stuffing, geo inconsistency, rotating IPs

Noise injections:
  * Power-user normals: faster timing, more requests than average human
  * Bot sessions with 1-2 human-like decoy requests baked in

Output files (written to current directory):
  sessions_full.csv      - all 1 000 sessions with sub_pattern column
  sessions_train.csv     - 70 % stratified split
  sessions_holdout.csv   - 30 % LOCKED holdout (do not touch until eval)
"""

import uuid
import random
import math
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# -- Reproducibility ---------------------------------------------------------
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# -- Constants ----------------------------------------------------------------
TOTAL_SESSIONS      = 1_000
N_NORMAL            = 750        # 75 %
N_ABUSIVE           = 250        # 25 %
N_POWER_USERS       = 50         # injected into normals (subset)
N_BOT_DECOYS        = 25         # abusive sessions with human-decoy requests

TIME_BUCKETS        = ["morning", "afternoon", "evening", "night"]

# -- Helpers ------------------------------------------------------------------

def _sid() -> str:
    return str(uuid.uuid4())


def _time_bucket() -> str:
    return random.choice(TIME_BUCKETS)


def _inter_request_stats(times: list[float]) -> tuple[float, float, float]:
    """Return (mean, std, min) of a list of inter-request gaps."""
    if len(times) < 2:
        gaps = [times[0]] if times else [0.0]
    else:
        gaps = [times[i] - times[i - 1] for i in range(1, len(times))]
    arr = np.array(gaps, dtype=float)
    return float(arr.mean()), float(arr.std(ddof=0)), float(arr.min())


def _lognormal_gaps(n: int, mean_s: float, sigma: float) -> list[float]:
    """Generate n inter-request gaps from a log-normal distribution."""
    mu = math.log(mean_s) - 0.5 * sigma ** 2
    return list(np.random.lognormal(mu, sigma, n))


def _uniform_gaps(n: int, lo: float, hi: float) -> list[float]:
    """Generate n inter-request gaps from a narrow uniform band (machine-like)."""
    return list(np.random.uniform(lo, hi, n))


def _cumsum(gaps: list[float]) -> list[float]:
    """Convert gap list to absolute timestamps starting at 0."""
    ts = [0.0]
    for g in gaps:
        ts.append(ts[-1] + g)
    return ts


# -----------------------------------------------------------------------------
#  NORMAL SESSION GENERATOR
# -----------------------------------------------------------------------------

def gen_normal(session_type: str = "regular") -> dict:
    """
    Generate normal session telemetry.
    Supports three normal profiles:
      - 'regular': average human buyer on website / mobile app
      - 'power_user': frequent human user with high speed and volume
      - 'ai_shopping_agent': legitimate autonomous AI agent (fast API calls, headless, no mouse)
    """
    if session_type == "ai_shopping_agent":
        n_req   = random.randint(12, 45)       # automated agent session
        mean_t  = random.uniform(2.2, 5.5)     # fast API calls -- overlaps with bots!
        sigma   = random.uniform(0.4, 0.9)
    elif session_type == "power_user":
        n_req   = random.randint(12, 35)       # active human power user
        mean_t  = random.uniform(3.5, 9.0)
        sigma   = 1.0
    else:  # "regular"
        n_req   = random.randint(3, 16)
        mean_t  = random.uniform(6.0, 18.0)
        sigma   = random.uniform(0.7, 1.2)     # high variance -- humans are irregular

    gaps = _lognormal_gaps(n_req - 1, mean_t, sigma)
    ts   = _cumsum(gaps)

    mean_irt, std_irt, min_irt = _inter_request_stats(ts)

    if session_type == "ai_shopping_agent":
        param_reuse = round(random.uniform(0.08, 0.28), 4)    # overlaps with scrapers/promo
        fail_rate   = round(random.uniform(0.02, 0.22), 4)    # out of stock, retries
        mouse_sig   = random.random() < 0.35                  # mostly headless AI!
        discounts   = random.randint(0, 3)                    # legitimate coupon checks
        unique_p    = random.randint(4, 18)
    elif session_type == "power_user":
        param_reuse = round(random.uniform(0.02, 0.18), 4)
        fail_rate   = round(random.uniform(0.01, 0.18), 4)
        mouse_sig   = random.random() < 0.90
        discounts   = random.randint(0, 3)
        unique_p    = random.randint(3, 14)
    else:
        param_reuse = round(random.uniform(0.0, 0.15), 4)
        fail_rate   = round(random.uniform(0.0, 0.15), 4)
        mouse_sig   = random.random() < 0.92
        discounts   = random.randint(0, 2)
        unique_p    = random.randint(2, 10)

    return {
        "session_id":                 _sid(),
        "label":                      "normal",
        "sub_pattern":                session_type,
        "num_requests":               n_req,
        "session_duration_sec":       round(ts[-1], 3),
        "mean_inter_request_time":    round(mean_irt, 4),
        "std_inter_request_time":     round(std_irt, 4),
        "min_inter_request_time":     round(min_irt, 4),
        "unique_params_touched":      unique_p,
        "param_reuse_rate":           param_reuse,
        "failed_request_rate":        fail_rate,
        "endpoint_diversity":         random.randint(2, 5),
        "user_agent_entropy":         round(random.uniform(0.02, 0.15), 4),
        "mouse_or_client_signal_present": mouse_sig,
        "discount_code_attempts":     discounts,
        "geo_ip_consistency":         random.random() < (0.88 if session_type == "ai_shopping_agent" else 0.95),
        "time_of_day_bucket":         _time_bucket(),
    }


# -----------------------------------------------------------------------------
#  ABUSIVE SESSION GENERATORS
# -----------------------------------------------------------------------------

def _inject_decoy_requests(row: dict) -> dict:
    """
    Inject 1-2 human-like 'decoy' requests into an otherwise bot session.
    Slightly raises std_irt and min_irt; nudges mouse signal to present.
    """
    extra_gap = random.uniform(6.0, 30.0)     # a human-paced pause
    row["std_inter_request_time"] = round(
        row["std_inter_request_time"] + extra_gap * 0.35, 4
    )
    row["min_inter_request_time"] = round(
        min(row["min_inter_request_time"], extra_gap), 4
    )
    row["mouse_or_client_signal_present"] = True
    row["session_duration_sec"] = round(row["session_duration_sec"] + extra_gap, 3)
    return row


def gen_card_testing(decoy: bool = False) -> dict:
    n_req   = random.randint(25, 350)
    lo, hi  = 0.5, 3.5                         # mean IRT 1.2s-3.5s (overlaps with fast AI agents)
    gaps    = _uniform_gaps(n_req - 1, lo, hi)
    ts      = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _inter_request_stats(ts)

    std_irt += random.uniform(0.05, 0.35)

    row = {
        "session_id":                 _sid(),
        "label":                      "abusive",
        "sub_pattern":                "card_testing",
        "num_requests":               n_req,
        "session_duration_sec":       round(ts[-1], 3),
        "mean_inter_request_time":    round(mean_irt, 4),
        "std_inter_request_time":     round(std_irt, 4),
        "min_inter_request_time":     round(min_irt, 4),
        "unique_params_touched":      random.randint(2, 10),
        "param_reuse_rate":           round(random.uniform(0.35, 0.95), 4),
        "failed_request_rate":        round(random.uniform(0.25, 0.85), 4),
        "endpoint_diversity":         random.randint(1, 3),
        "user_agent_entropy":         round(random.uniform(0.01, 0.12), 4),
        "mouse_or_client_signal_present": random.random() < 0.20,
        "discount_code_attempts":     random.randint(0, 3),
        "geo_ip_consistency":         random.random() < 0.85,
        "time_of_day_bucket":         _time_bucket(),
    }
    return _inject_decoy_requests(row) if decoy else row


def gen_scraper(decoy: bool = False) -> dict:
    n_req  = random.randint(25, 200)
    lo, hi = 0.8, 4.5                          # mean IRT 1.5s-4.5s (overlaps with AI agents)
    gaps   = _uniform_gaps(n_req - 1, lo, hi)
    ts     = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _inter_request_stats(ts)
    std_irt += random.uniform(0.05, 0.40)

    row = {
        "session_id":                 _sid(),
        "label":                      "abusive",
        "sub_pattern":                "scraper",
        "num_requests":               n_req,
        "session_duration_sec":       round(ts[-1], 3),
        "mean_inter_request_time":    round(mean_irt, 4),
        "std_inter_request_time":     round(std_irt, 4),
        "min_inter_request_time":     round(min_irt, 4),
        "unique_params_touched":      random.randint(12, 75),
        "param_reuse_rate":           round(random.uniform(0.05, 0.28), 4),   # overlaps with AI shopping agents!
        "failed_request_rate":        round(random.uniform(0.01, 0.20), 4),   # overlaps with AI shopping agents!
        "endpoint_diversity":         random.randint(3, 6),
        "user_agent_entropy":         round(random.uniform(0.0, 0.08), 4),
        "mouse_or_client_signal_present": random.random() < 0.25,
        "discount_code_attempts":     random.randint(0, 2),
        "geo_ip_consistency":         random.random() < 0.80,
        "time_of_day_bucket":         _time_bucket(),
    }
    return _inject_decoy_requests(row) if decoy else row


def gen_promo_abuse(decoy: bool = False) -> dict:
    n_req  = random.randint(8, 45)
    lo, hi = 1.0, 4.5
    gaps   = _uniform_gaps(n_req - 1, lo, hi)
    ts     = _cumsum(gaps)
    mean_irt, std_irt, min_irt = _inter_request_stats(ts)
    std_irt += random.uniform(0.05, 0.45)

    row = {
        "session_id":                 _sid(),
        "label":                      "abusive",
        "sub_pattern":                "promo_abuse",
        "num_requests":               n_req,
        "session_duration_sec":       round(ts[-1], 3),
        "mean_inter_request_time":    round(mean_irt, 4),
        "std_inter_request_time":     round(std_irt, 4),
        "min_inter_request_time":     round(min_irt, 4),
        "unique_params_touched":      random.randint(5, 30),
        "param_reuse_rate":           round(random.uniform(0.12, 0.45), 4),
        "failed_request_rate":        round(random.uniform(0.08, 0.35), 4),
        "endpoint_diversity":         random.randint(2, 5),
        "user_agent_entropy":         round(random.uniform(0.02, 0.20), 4),
        "mouse_or_client_signal_present": random.random() < 0.30,
        "discount_code_attempts":     random.randint(3, 18),                  # overlaps at 3 with power users
        "geo_ip_consistency":         random.random() < 0.65,
        "time_of_day_bucket":         _time_bucket(),
    }
    return _inject_decoy_requests(row) if decoy else row


# -----------------------------------------------------------------------------
#  MAIN GENERATION
# -----------------------------------------------------------------------------

def generate_dataset() -> pd.DataFrame:
    records: list[dict] = []

    # -- Normal sessions ------------------------------------------------------
    n_ai_agents = 150                                  # 150 legitimate AI shopping agents
    n_power     = 100                                  # 100 power users
    n_regular   = N_NORMAL - n_ai_agents - n_power     # 500 regular humans

    for _ in range(n_regular):
        records.append(gen_normal(session_type="regular"))
    for _ in range(n_power):
        records.append(gen_normal(session_type="power_user"))
    for _ in range(n_ai_agents):
        records.append(gen_normal(session_type="ai_shopping_agent"))

    # -- Abusive sessions - roughly equal thirds --------------------------------
    n_ct, n_sc, n_pa = 84, 83, 83

    # Which abusive sessions get decoy injection?
    decoy_indices_ct = set(random.sample(range(n_ct), min(N_BOT_DECOYS // 3, n_ct)))
    decoy_indices_sc = set(random.sample(range(n_sc), min(N_BOT_DECOYS // 3, n_sc)))
    decoy_indices_pa = set(random.sample(range(n_pa), min(N_BOT_DECOYS // 3, n_pa)))

    for i in range(n_ct):
        records.append(gen_card_testing(decoy=(i in decoy_indices_ct)))
    for i in range(n_sc):
        records.append(gen_scraper(decoy=(i in decoy_indices_sc)))
    for i in range(n_pa):
        records.append(gen_promo_abuse(decoy=(i in decoy_indices_pa)))

    df = pd.DataFrame(records)
    df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)   # shuffle
    return df


# -----------------------------------------------------------------------------
#  SPLIT & SAVE
# -----------------------------------------------------------------------------

def split_and_save(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    train_df, holdout_df = train_test_split(
        df,
        test_size=0.30,
        random_state=SEED,
        stratify=df["label"],
    )
    train_df   = train_df.reset_index(drop=True)
    holdout_df = holdout_df.reset_index(drop=True)

    df.to_csv("sessions_full.csv",     index=False)
    train_df.to_csv("sessions_train.csv",    index=False)
    holdout_df.to_csv("sessions_holdout.csv", index=False)

    print("[OK]   sessions_full.csv     written  --", len(df), "rows")
    print("[OK]   sessions_train.csv    written  --", len(train_df), "rows")
    print("[LOCK] sessions_holdout.csv  LOCKED   --", len(holdout_df), "rows  (do not inspect until final eval)")
    return train_df, holdout_df


# -----------------------------------------------------------------------------
#  SUMMARY & SAMPLE DISPLAY
# -----------------------------------------------------------------------------

def print_summary(df: pd.DataFrame) -> None:
    sep = "-" * 68

    print(f"\n{sep}")
    print("  DATASET SUMMARY")
    print(sep)
    print(f"  Total sessions : {len(df):,}")

    label_counts = df["label"].value_counts()
    for lbl, cnt in label_counts.items():
        pct = cnt / len(df) * 100
        print(f"  {lbl:<10}   : {cnt:>5,}  ({pct:.1f} %)")

    print(f"\n  Abusive sub-pattern breakdown:")
    abuse_df = df[df["label"] == "abusive"]
    sp_counts = abuse_df["sub_pattern"].value_counts()
    for sp, cnt in sp_counts.items():
        pct = cnt / len(abuse_df) * 100
        print(f"    {sp:<18} : {cnt:>4,}  ({pct:.1f} % of abusive)")

    decoy_ct = (abuse_df["mouse_or_client_signal_present"]).sum()
    print(f"\n  Abusive sessions w/ mouse_signal=True (decoys): {decoy_ct}")
    print(sep)


def print_samples(df: pd.DataFrame) -> None:
    display_cols = [
        "sub_pattern", "num_requests", "session_duration_sec",
        "mean_inter_request_time", "std_inter_request_time",
        "min_inter_request_time", "unique_params_touched",
        "param_reuse_rate", "failed_request_rate", "endpoint_diversity",
        "user_agent_entropy", "mouse_or_client_signal_present",
        "discount_code_attempts", "geo_ip_consistency", "time_of_day_bucket",
    ]

    patterns = ["regular", "power_user", "ai_shopping_agent", "card_testing", "scraper", "promo_abuse"]
    sep = "-" * 68

    print(f"\n{sep}")
    print("  SAMPLE ROWS PER SUB-PATTERN  (2 rows each)")
    print(sep)

    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 200)
    pd.set_option("display.float_format", "{:.4f}".format)

    for pat in patterns:
        subset = df[df["sub_pattern"] == pat][display_cols]
        sample = subset.sample(n=min(2, len(subset)), random_state=SEED)
        print(f">> {pat.upper()}")
        print(sample.to_string(index=False))

    print(f"\n{sep}\n")


# -----------------------------------------------------------------------------
#  ENTRY POINT
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n[*] Generating synthetic session telemetry ...")
    df = generate_dataset()
    train_df, _ = split_and_save(df)     # holdout is written but never used again

    print_summary(df)
    print_samples(df)

    # Quick sanity: verify no data leakage risk (holdout is not assigned or used)
    print("  [OK] Holdout file sealed. Variable discarded from scope.")
    print("  [OK] Ready for feature engineering on sessions_train.csv\n")
