"""Pydantic v2 request/response schemas for TraceRoot."""
from datetime import datetime
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# --- Auth ---
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime


# --- Transactions ---
class TransactionIn(BaseModel):
    date: str  # ISO
    sender: str
    receiver: str
    amount: float
    currency: str = "USD"
    description: Optional[str] = ""


class Transaction(TransactionIn):
    tx_id: str = Field(default_factory=lambda: _uid("tx"))
    case_id: str


# --- Cases ---
class CaseCreate(BaseModel):
    subject: str
    channel: str = "Wire"
    country: str = "US → US"
    notes: Optional[str] = ""
    # optional raw txs (from CSV parse)
    transactions: List[TransactionIn] = []


class Case(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_id: str
    subject: str
    channel: str
    country: str
    reported_at: datetime
    owner_id: str
    status: Literal["open", "frozen", "closed"] = "open"
    amount: float = 0.0
    currency: str = "USD"
    risk: Literal["freeze", "monitor", "safe"] = "safe"
    risk_score: int = 0
    tx_count: int = 0


# --- Risk ---
class RiskFactor(BaseModel):
    key: str
    label: str
    points: int
    meta: str


class RiskScore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_id: str
    total: int
    risk: Literal["freeze", "monitor", "safe"]
    factors: List[RiskFactor]
    computed_at: datetime


# --- Graph ---
class GraphNode(BaseModel):
    id: str
    label: str
    role: Literal["victim", "mule", "cashout", "merchant", "unknown"]
    risk: Literal["freeze", "monitor", "safe"] = "safe"
    total_out: float = 0.0
    total_in: float = 0.0


class GraphEdge(BaseModel):
    source: str
    target: str
    amount: float
    tx_count: int
    first_seen: str
    last_seen: str


class GraphPayload(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# --- Copilot ---
CopilotKind = Literal["summary", "report", "freeze_justification", "next_steps"]


class CopilotRequest(BaseModel):
    kind: CopilotKind
    language: str = "en"  # en, hi, ta


class CopilotResponse(BaseModel):
    kind: CopilotKind
    language: str
    text: str
    generated_at: datetime


class AccountAssessmentRequest(BaseModel):
    account_id: str = Field(min_length=1, max_length=200)
    language: str = "en"


class AccountAssessmentResponse(BaseModel):
    account_id: str
    score: int = Field(ge=0, le=100)
    risk: Literal["freeze", "monitor", "safe"]
    evidence: List[str]
    explanation: str
    generated_at: datetime
    source: Literal["ollama", "local_fallback"]


# --- Recommendation ---
class Recommendation(BaseModel):
    account_id: str
    label: str
    verdict: Literal["freeze", "monitor", "safe"]
    reason: str


# --- Ingestion ---
class IngestResponse(BaseModel):
    case_id: str
    accepted: int
    rejected: int
    errors: List[str] = []
