"""Strict file-grounded fantasy basketball draft engine."""
from __future__ import annotations
import io
import pandas as pd

REQUIRED = ["PLAYER","ADP_RANK","PTS","REB","AST","STL","BLK","3PM","FG%","FT%","TO"]
COUNTING = ["PTS","REB","AST","STL","BLK","3PM","TO"]

def snake_pick(round_no: int, slot: int, teams: int = 12) -> int:
    if round_no < 1 or teams < 2 or not (1 <= slot <= teams):
        raise ValueError("Invalid round, slot or number of teams")
    return (round_no - 1) * teams + (slot if round_no % 2 else teams + 1 - slot)

def read_board(content: bytes, name: str) -> pd.DataFrame:
    if name.lower().endswith(".xlsx"):
        book = pd.ExcelFile(io.BytesIO(content))
        sheet = "DraftBoard" if "DraftBoard" in book.sheet_names else book.sheet_names[0]
        board = pd.read_excel(book, sheet_name=sheet)
    elif name.lower().endswith(".csv"):
        board = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    else:
        raise ValueError("Upload CSV or XLSX")
    board.columns = board.columns.astype(str).str.strip()
    missing = sorted(set(REQUIRED) - set(board.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    board = board.dropna(subset=["PLAYER", "ADP_RANK"]).copy()
    board["PLAYER"] = board["PLAYER"].astype(str).str.strip()
    if board["PLAYER"].str.casefold().duplicated().any():
        raise ValueError("Duplicate PLAYER names found")
    numeric = [c for c in REQUIRED if c not in ["PLAYER"]]
    numeric += [c for c in ("FGM","FGA","FTM","FTA","GP","ADP_AVG") if c in board]
    for col in numeric:
        board[col] = pd.to_numeric(board[col].astype(str).str.replace(",","",regex=False).str.replace("%","",regex=False), errors="coerce")
    if board["ADP_RANK"].isna().any() or (board["ADP_RANK"] <= 0).any():
        raise ValueError("Missing or invalid ADP_RANK")
    if board["ADP_RANK"].duplicated().any():
        raise ValueError("Duplicate ADP_RANK; investigate source before recommending")
    for col in ("FG%","FT%"):
        board.loc[board[col] > 1, col] /= 100
        if ((board[col] < 0) | (board[col] > 1)).any():
            raise ValueError(f"Invalid percentage: {col}")
    return board.sort_values("ADP_RANK").reset_index(drop=True)

def candidate_pool(board: pd.DataFrame, pick: int, ours: list[str], others: list[str],
                   confirmed: list[str] | None = None, window: int = 7) -> pd.DataFrame:
    drafted = set(ours) | set(others)
    pool = board.loc[~board["PLAYER"].isin(drafted)].copy()
    if confirmed is not None:
        pool = pool.loc[pool["PLAYER"].isin(confirmed)]
        pool["Availability"] = "Confirmed by user"
    else:
        pool = pool.loc[pool["ADP_RANK"].between(pick-window,pick+window)]
        pool["Availability"] = "ADP-based candidate; not confirmed undrafted"
    pool["Pick_gap"] = pool["ADP_RANK"] - pick
    return pool.sort_values(["ADP_RANK"])

def team_totals(board: pd.DataFrame, roster: list[str]) -> dict:
    rows = board.loc[board["PLAYER"].isin(roster)]
    if len(rows) != len(set(roster)):
        raise ValueError("Some selected players are missing from uploaded file")
    ans = {cat: (float(rows[cat].sum()) if rows[cat].notna().all() else None) for cat in COUNTING}
    for prefix in ("FG","FT"):
        m,a=prefix+"M",prefix+"A"
        if m in rows and a in rows and rows[m].notna().all() and rows[a].notna().all() and rows[a].sum()>0:
            ans[prefix+"%"] = float(rows[m].sum()/rows[a].sum())
        else:
            ans[prefix+"%"] = None
    return ans
