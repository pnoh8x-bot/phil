"""League-scoped state, identity-only roster derivation, no server global cache."""
from datetime import datetime,timezone
from recommendations import yahoo_id,infer_slot
from yahoo_sync import validate_snapshot

def derive_state(raw,league,season,team_id,teams=12,room_id=None):
    s=validate_snapshot(raw,league,season)
    if room_id is not None and (not s.get('live') or str(s.get('room_id'))!=str(room_id)):
        raise ValueError('연결된 모크 방의 결과가 아닙니다. 확장 0.2.4 이상에서 해당 방의 Results → Round by Round를 수집하세요.')
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
    current=scoreboard if scoreboard is not None else after if not s.get('live') and s['complete_pick_sequence'] and s['picks'] else None
    stamp=s.get('picks_at')
    try:age=(datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds()
    except (ValueError,TypeError,AttributeError):age=None
    if age is not None and age< -10:raise ValueError('Observation timestamp is in the future')
    fresh=age is not None and -10<=age<=45
    reasons=[]
    def pause(code,message):reasons.append({'code':code,'message':message})
    if s.get('connection_error'):pause('disconnected',s['connection_error'])
    if age is None:pause('no_result_timestamp','결과 표 수신 시간이 없습니다. 같은 Yahoo 탭에서 Results → Round by Round를 표시하세요.')
    elif not fresh:pause('stale_results',f'마지막 지명 결과 수신이 {max(0,int(age))}초 전입니다(허용 45초). Yahoo 결과 화면을 열어 새 결과를 수집하세요.')
    if not own_label:pause('unknown_team','연결한 팀 ID와 Yahoo 결과의 내 팀을 아직 연결하지 못했습니다.')
    if slot is None:pause('unknown_slot','내 스네이크 지명 순번이 미확인입니다. Yahoo의 현재 차례 표시 또는 내 첫 지명 기록이 필요합니다.')
    if current is None:pause('unknown_clock','현재 전체 픽 번호를 읽지 못했습니다. Yahoo 상단 Round / Pick 표시가 보이는지 확인하세요.')
    seen={p['pick'] for p in s['picks']}
    end=current-1 if current is not None else after-1
    missing=sorted(set(range(1,end+1))-seen)
    if missing:
        shown=', '.join(map(str,missing[:12]))+(' …' if len(missing)>12 else '')
        pause('missing_picks',f'아직 수집하지 못한 전체 지명 번호: {shown} (총 {len(missing)}개). Results → Round by Round에서 해당 구간을 표시하세요.')
    if not s.get('history_complete',True) and not missing:pause('unverified_history','마지막 결과 관찰이 전체 이력으로 검증되지 않았습니다. 지명 수가 맞아도 화면 일부만 수집했을 수 있습니다.')
    if not s['complete_pick_sequence'] and not missing:pause('discontinuous_history','지명 기록의 연결 상태가 불완전합니다.')
    return {'snapshot':s,'ours':ours,'drafted':drafted,'slot':slot,'current':current,'age_seconds':age,
            'ready':not reasons,'pause_reasons':reasons,'missing_picks':missing,'history_next':after,
            'team_resolved':bool(own_label),'early_ids':ours[:2]}
