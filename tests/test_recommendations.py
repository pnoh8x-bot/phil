"""Synthetic arithmetic fixtures only; none are offered as NBA projections."""
import math
import pandas as pd
from datetime import datetime,timezone,timedelta
from recommendations import *
from draft_state import derive_state

def fixture():
    rows=[]
    for i in range(1,11):
        fga=8+i;fta=2+i/2;fg=.4+i*.025;ft=.6+i*.025
        rows.append(dict(YAHOO_ID=str(i),PLAYER='Synthetic '+str(i),PTS=10+i*2,REB=12-i/2,AST=2+i%4,STL=.4+i*.12,BLK=.2+i%3*.4,TO=1+i*.2,GP=60+i,ADP_AVG=2+i*5,STAT_BASIS='per_game',FGM=fga*fg,FGA=fga,FTM=fta*ft,FTA=fta,**{'3PM':i*.3,'FG%':fg,'FT%':ft}))
    return pd.DataFrame(rows)

def rejects(fn):
    try:fn()
    except ValueError:return
    raise AssertionError('Expected invalid data to be rejected')

def test_zscore_mean_and_population_variance():
    m=evaluate_board(fixture())
    assert set(m.categories)==set(CATS)
    for c in CATS:
        assert abs(m.z[c].mean())<1e-10
        assert abs(m.z[c].std(ddof=0)-1)<1e-10

def test_lower_turnovers_are_better():
    m=evaluate_board(fixture());assert m.z.loc['1','TO']>m.z.loc['10','TO']

def test_volume_weighted_percentage_baseline():
    b=fixture();m=evaluate_board(b)
    assert abs(m.baseline['FG%']-b.FGM.sum()/b.FGA.sum())<1e-12
    impact=b.FGM-m.baseline['FG%']*b.FGA
    expected=(impact-impact.mean())/impact.std(ddof=0)
    assert abs(m.z.loc['1','FG%']-expected.iloc[0])<1e-10

def test_percent_only_never_invents_attempts():
    m=evaluate_board(fixture().drop(columns=['FGM','FGA','FTM','FTA']))
    assert 'FG%' not in m.categories and 'FT%' not in m.categories
    assert len(m.categories)==7

def test_same_name_different_ids_do_not_exclude_each_other():
    b=fixture();b.loc[0,'PLAYER']=b.loc[1,'PLAYER']='Same name'
    m=evaluate_board(b);rec=recommend(m,[],['1'],3,3)
    assert all(p['YAHOO_ID']!='1' for p in rec)
    assert '2' in m.board.index

def test_all_drafted_and_own_ids_are_excluded():
    m=evaluate_board(fixture());out=recommend(m,['1'],['2','3','4'],5,3)
    assert all(x['YAHOO_ID'] not in {'1','2','3','4'} for x in out)

def test_must_and_backup_are_unique_and_explained():
    r=recommend(evaluate_board(fixture()),['1'],['2'],3,3)
    assert [x['role'] for x in r]==['Must Pick','Must Pick','Backup','Backup']
    assert len({x['YAHOO_ID'] for x in r})==4
    assert all('strengthens' in x and 'protect' in x and 'wait' in x for x in r)

def test_no_padding_when_fewer_candidates():
    m=evaluate_board(fixture());out=recommend(m,[],[str(i) for i in range(1,10)],3,3)
    assert len(out)==1

def test_punt_search_enumerates_all_single_and_double_punts():
    p=punt_strategies(evaluate_board(fixture()),['1','2'])
    assert len(p)==46 and p[0]['score']>=p[-1]['score']
    assert not p[0]['provisional'] and all(len(x['retained'])>=5 for x in p)

def test_early_pair_strategy_is_provisional_with_one_anchor():
    m=evaluate_board(fixture());assert not punt_strategies(m,[])
    assert punt_strategies(m,['1'])[0]['provisional']
    assert punt_strategies(m,['1','2','3'])[0]['anchors']==['1','2']

def test_roster_ratio_and_strength_weakness():
    m=evaluate_board(fixture());p=roster_profile(m,['1','2'])
    rows=m.board.loc[['1','2']]
    assert abs(p['totals_per_game']['FG%']-rows.FGM.sum()/rows.FGA.sum())<1e-12
    assert p['strong'] and p['weak'] and p['count']==2

def test_season_totals_normalize_to_same_per_game_values():
    b=fixture();total=b.copy()
    for c in list(COUNTS)+['FGM','FGA','FTM','FTA']:total[c]*=total.GP
    total.STAT_BASIS='season_total'
    a=evaluate_board(b);t=evaluate_board(total)
    assert (a.z-t.z).abs().max().max()<1e-9

def test_unknown_units_mixed_basis_zero_gp_stop():
    b=fixture();rejects(lambda:evaluate_board(b.drop(columns='STAT_BASIS')))
    b.loc[0,'STAT_BASIS']='season_total';rejects(lambda:evaluate_board(b))
    b.STAT_BASIS='season_total';b.loc[0,'GP']=0;rejects(lambda:evaluate_board(b))

def test_duplicate_missing_or_wrong_ids_stop():
    b=fixture();rejects(lambda:evaluate_board(b.drop(columns='YAHOO_ID')))
    b.loc[0,'YAHOO_ID']='2';rejects(lambda:evaluate_board(b))
    for value in [True,None,float('nan'),'abc','1.5']:
        rejects(lambda:yahoo_id(value))

def test_invalid_numeric_infinite_and_shot_data_stop():
    for c,v in [('PTS',float('inf')),('TO',-1),('FGM',999)]:
        b=fixture();b[c]=b[c].astype(float);b.loc[0,c]=v;rejects(lambda:evaluate_board(b))

def test_zero_variance_category_is_unavailable():
    b=fixture();b.AST=1;m=evaluate_board(b);assert 'AST' not in m.categories

def test_unknown_roster_and_missing_active_stat_pause():
    m=evaluate_board(fixture());rejects(lambda:recommend(m,['999'],[],1,3))
    b=fixture();b.loc[0,'PTS']=float('nan');m=evaluate_board(b)
    rejects(lambda:recommend(m,['1'],[],1,3))

def test_snake_boundary_and_next_two_own_picks():
    assert next_picks(1,1)==(1,24)
    assert next_picks(3,3)==(3,22)
    assert next_picks(22,3)==(22,27)
    assert next_picks(23,3)==(27,46)
    assert next_picks(12,12)==(12,13)

def snapshot(age=0,picks=None):
    return dict(version=1,league_id='123',season=2026,live=True,current_pick=4,draft_slot=3,history_complete=True,picks_at=(datetime.now(timezone.utc)-timedelta(seconds=age)).isoformat(),picks=picks or [dict(pick=i,player_id=str(i),player='Synthetic '+str(i),team='__OUR_TEAM__' if i==3 else 'Other') for i in range(1,4)])

def test_state_derives_roster_and_slot_by_id_only():
    s=derive_state(snapshot(),'123',2026,'9');assert s['ours']==['3'] and s['slot']==3 and s['ready']

def test_stale_and_partial_history_pause_recommendations():
    assert not derive_state(snapshot(90),'123',2026,'9')['ready']
    b=snapshot();b['picks']=b['picks'][1:];assert not derive_state(b,'123',2026,'9')['ready']
    b=snapshot();b['history_complete']=False;assert not derive_state(b,'123',2026,'9')['ready']

def test_conflicting_slot_clock_and_team_size_stop():
    b=snapshot();b['draft_slot']=2;rejects(lambda:derive_state(b,'123',2026,'9'))
    b=snapshot();b['current_pick']=2;rejects(lambda:derive_state(b,'123',2026,'9'))
    b=snapshot();b['draft_teams']=14;rejects(lambda:derive_state(b,'123',2026,'9'))

def test_adp_wait_is_threshold_not_probability():
    r=recommend(evaluate_board(fixture()),[],[],1,3)
    for p in r:
        assert p['next_my_pick']==22
        assert ('지명 위험' in p['wait'])==(p['ADP']<22)
        assert not any('probability' in k or 'win' in k for k in p)

def test_missing_row_units_and_invalid_percentages_stop():
    b=fixture();b.loc[0,'STAT_BASIS']=None;rejects(lambda:evaluate_board(b))
    b=fixture();b.loc[0,'FG%']=55;rejects(lambda:evaluate_board(b))

def test_trailing_unobserved_picks_and_unresolved_team_pause():
    b=snapshot();b['current_pick']=8;assert not derive_state(b,'123',2026,'9')['ready']
    b=snapshot();b['live']=False;assert not derive_state(b,'123',2026,'9')['ready']

def test_canonical_duplicate_and_boolean_pick_ids_rejected():
    b=snapshot();b['picks'][1]['player_id']='001';rejects(lambda:derive_state(b,'123',2026,'9'))
    b=snapshot();b['picks'][0]['pick']=True;rejects(lambda:derive_state(b,'123',2026,'9'))

def test_corrupt_file_numbers_and_missing_rank_do_not_drop_rows():
    from draft_engine import read_board
    b=fixture();b['ADP_RANK']=range(1,len(b)+1);b.PTS=b.PTS.astype(object);b.loc[0,'PTS']='garbage'
    rejects(lambda:read_board(b.to_csv(index=False).encode(),'test.csv'))
    b=fixture();b['ADP_RANK']=float('nan');rejects(lambda:read_board(b.to_csv(index=False).encode(),'test.csv'))

def test_missing_adp_is_unknown_not_yahoo_rank():
    b=fixture().drop(columns='ADP_AVG');b['ADP_AVG']=float('nan')
    r=recommend(evaluate_board(b),[],[],1,3)
    assert all(p['ADP'] is None and '판단 불가' in p['wait'] and p['future_candidates']==0 for p in r)
