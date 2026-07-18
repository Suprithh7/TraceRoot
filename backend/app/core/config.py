"""Central config: env vars and app-wide constants."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
# Local, on-prem model configuration.  No hosted model key is required for the
# investigation workflow.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# Risk scoring rule weights (explainable, additive).
RISK_WEIGHTS = {
    "flash_drain": 20,
    "structuring": 25,
    "known_mule": 15,
    "rapid_transfers": 20,
    "cross_border": 10,
    "new_beneficiary": 8,
    "off_hours": 6,
    "round_dollar": 6,
}

FLASH_DRAIN_WINDOW_MIN = 15
STRUCTURING_THRESHOLD = 10000
STRUCTURING_BUFFER = 500  # amounts within $500 below threshold
RAPID_TX_MIN_COUNT = 5
RAPID_TX_WINDOW_HOURS = 24

# Known mule watchlist (demo).
KNOWN_MULE_ACCOUNTS = {
    "acct_mule_9033", "acct_mule_2210", "acct_mule_7761", "acct_mule_4408",
    "wallet_0x7af2", "acct_mule_3390",
}
