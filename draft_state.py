"""League-scoped state, identity-only roster derivation, no server global cache."""
from datetime import datetime,timezone
from recommendations import yahoo_id,infer_slot
from yahoo_sync import validate_snapshot

def derive_state(raw,league,season,team_id,teams=12):
    s=validate_snapshot(raw,league,season)
    if s.get('draft_teams') and s['draft_teams']!=teams:raise ValueError('Observed team count differs from this 12-team model')
    teamnames={str(t['id']):t['name'] for t in s.get('teams',[]) if isinstance(t,dict) and 'id' in t and 'name' in t}
    own_label='__OUR_TEAM__' if s.get('live') else teamnames.get(str(team_id))
    ours=[yahoo_id(p['player_id']) for p in s['picks'] if p['team']==own_label]
    drafted=[yahoo_id(p['player_id']) for p in s['picks']]
    slot=infer_slot(s['picks'],ours,teams)
    explicit=s.get('draft_slot')
    if explicit is not None:
        if isinstance(explicit,bool) or not isinstance(explicit,int) or not 1<=explicit<=teams:raise ValueError('Invalid observed draft slot')
        if slot and slot!=explicit:raise ValueError('Observed slot conflicts with own picks')
        slot=explicit
    scoreboard=s.get('current_pick')
    after=max((p['pick'] for p in s['picks']),default=0)+1
    if scoreboard is not None and scoreboard<after:raise ValueError('Current pick is older than result history')
    current=scoreboard if scoreboard is not None else after if s['complete_pick_sequence'] and s['picks'] else None
    stamp=s.get('picks_at')
    try:age=(datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds()
    except (ValueError,TypeError,AttributeError):age=None
    if age is not None and age< -10:raise ValueError('Observation timestamp is in the future')
    fresh=age is not None and -10<=age<=45
    return {'snapshot':s,'ours':ours,'drafted':drafted,'slot':slot,'current':current,'age_seconds':age,
            'ready':fresh and not s.get('connection_error') and bool(own_label) and slot is not None and current==after and s['complete_pick_sequence'] and s.get('history_complete',True),
            'team_resolved':bool(own_label),'early_ids':ours[:2]}
