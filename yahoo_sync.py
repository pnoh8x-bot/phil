"""Validate browser observations. No Yahoo HTTP requests or credentials."""
from datetime import datetime, timezone
import io
import pandas as pd
from draft_engine import REQUIRED, read_board

def validate_snapshot(value, league_id, season):
    if not isinstance(value, dict) or value.get('version') != 1:
        raise ValueError('Unsupported browser snapshot')
    if value.get('historical'):
        raise ValueError('Historical draft results cannot be used for live sync')
    if str(value.get('league_id')) != str(league_id):
        raise ValueError('Snapshot belongs to another league')
    if int(value.get('season', 0)) != int(season):
        raise ValueError('Snapshot belongs to another season; historical picks cannot be used')
    if len(str(value)) > 2_000_000:
        raise ValueError('Browser snapshot is too large')
    picks = value.get('picks', [])
    if not isinstance(picks, list) or len(picks) > 1000:
        raise ValueError('Invalid pick list')
    seen = set()
    ids = set()
    for p in picks:
        if not isinstance(p, dict) or not isinstance(p.get('pick'), int) or not 1 <= p['pick'] <= 1000:
            raise ValueError('Invalid pick number')
        if p['pick'] in seen or str(p.get('player_id')) in ids:
            raise ValueError('Duplicate pick or player; sync stopped')
        if not str(p.get('player_id', '')).isdigit() or not isinstance(p.get('player'), str):
            raise ValueError('Missing Yahoo player identity')
        seen.add(p['pick']); ids.add(str(p['player_id']))
    value = dict(value)
    value['picks'] = sorted(picks, key=lambda p: p['pick'])
    # Never infer the current overall pick from a partial/virtualized list.
    value['complete_pick_sequence'] = seen == set(range(1, max(seen, default=0) + 1))
    return value

def browser_board(snapshot):
    rows = snapshot.get('board', [])
    if not isinstance(rows, list) or len(rows) > 1000:
        raise ValueError('Invalid browser player board')
    if not rows:
        return None
    frame = pd.DataFrame(rows)
    if not set(REQUIRED).issubset(frame.columns):
        return None
    # ADP is derived only from a displayed Avg Pick value, never Yahoo ranks.
    if 'ADP_AVG' not in frame:
        return None
    frame = frame.dropna(subset=['PLAYER', 'ADP_AVG'])
    if frame.empty:
        return None
    frame['ADP_AVG'] = pd.to_numeric(frame['ADP_AVG'], errors='coerce')
    frame = frame.dropna(subset=['ADP_AVG']).sort_values(['ADP_AVG', 'PLAYER'])
    frame['ADP_RANK'] = range(1, len(frame)+1)
    return read_board(frame.to_csv(index=False).encode(), 'browser.csv')

def match_picks(board, picks, our_team):
    from unicodedata import normalize
    def key(name):
        return ''.join(c for c in normalize('NFKD', name.casefold()) if c.isalnum())
    names = {}
    for name in board['PLAYER']:
        names.setdefault(key(name), []).append(name)
    by_id = dict(zip(board['YAHOO_ID'].astype(str), board['PLAYER'])) if 'YAHOO_ID' in board else {}
    ours, others, missing = [], [], []
    for p in picks:
        name = by_id.get(str(p['player_id']))
        candidates = names.get(key(p['player']), [])
        if name is None and len(candidates) == 1:
            name = candidates[0]
        if name is None:
            missing.append(p['player']); continue
        (ours if p.get('team') == our_team else others).append(name)
    return ours, others, missing
