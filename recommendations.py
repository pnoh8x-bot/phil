"""Deterministic 9CAT draft decisions. Scores are descriptive, never win odds."""
from dataclasses import dataclass
from itertools import combinations
import math
import numbers
import numpy as np
import pandas as pd

CATS=('PTS','REB','AST','STL','BLK','3PM','FG%','FT%','TO')
COUNTS=('PTS','REB','AST','STL','BLK','3PM','TO')

def yahoo_id(value):
    if isinstance(value,bool) or pd.isna(value):raise ValueError('Missing Yahoo player ID')
    if isinstance(value,numbers.Real):
        if not math.isfinite(value) or int(value)!=value:raise ValueError('Invalid Yahoo player ID')
        value=str(int(value))
    value=str(value).strip()
    if not value.isdigit() or int(value)<=0:raise ValueError('Invalid Yahoo player ID')
    return str(int(value))

@dataclass
class Evaluation:
    board:pd.DataFrame
    z:pd.DataFrame
    categories:tuple
    unavailable:dict
    baseline:dict
    population:int
    normalization_unavailable:tuple=()

def evaluate_board(source,basis=None):
    """Population ddof=0. Rate categories use made-minus-baseline*attempts."""
    b=source.copy()
    if 'YAHOO_ID' not in b:raise ValueError('Yahoo IDs are required; name guessing is disabled')
    b['YAHOO_ID']=b['YAHOO_ID'].map(yahoo_id)
    if b['YAHOO_ID'].duplicated().any():raise ValueError('Duplicate Yahoo player IDs')
    b=b.set_index('YAHOO_ID',drop=False)
    if len(b)<3:raise ValueError('At least three verified players are needed for Z-scores')
    if basis is None:
        if 'STAT_BASIS' not in b:raise ValueError('Declare per_game or season_total statistic units')
        units=set(b['STAT_BASIS'].dropna())
        if len(units)!=1 or b['STAT_BASIS'].isna().any():raise ValueError('Mixed or missing statistic units')
        basis=next(iter(units))
    if basis not in ('per_game','season_total'):raise ValueError('Unknown statistic units')
    for col in list(CATS)+['FGM','FGA','FTM','FTA','GP','ADP_AVG','ADP_RANK']:
        if col not in b:continue
        original=b[col]
        b[col]=pd.to_numeric(original,errors='coerce')
        bad=original.notna() & b[col].isna()
        if bad.any() or np.isinf(b[col]).any():raise ValueError('Invalid numeric data: '+col)
        if (b[col].dropna()<0).any():raise ValueError('Negative statistic: '+col)
        if col in ('FG%','FT%') and (b[col].dropna()>1).any():raise ValueError('Percentages must be fractions: '+col)
    unavailable_rows=()
    if basis=='season_total':
        if 'GP' not in b:raise ValueError('Season totals require observed GP')
        valid_gp=b.GP.notna() & (b.GP>0)
        unavailable_rows=tuple(b.index[~valid_gp])
        for col in list(COUNTS)+['FGM','FGA','FTM','FTA']:
            if col in b:b[col]=b[col]/b['GP'].where(valid_gp)
    values={};unavailable={};baseline={}
    for cat in COUNTS:
        if cat in b:values[cat]=b[cat]*(-1 if cat=='TO' else 1)
        else:unavailable[cat]='Column missing'
    for prefix in ('FG','FT'):
        made,attempt=prefix+'M',prefix+'A';cat=prefix+'%'
        if made not in b or attempt not in b:
            unavailable[cat]='Made/attempted volume missing; percentage-only value is not estimated';continue
        if ((b[made]>b[attempt])&b[made].notna()&b[attempt].notna()).any():raise ValueError(made+' exceeds attempts')
        valid=b[[made,attempt]].notna().all(axis=1)
        total=b.loc[valid,attempt].sum()
        if total<=0:unavailable[cat]='No shot attempts';continue
        baseline[cat]=float(b.loc[valid,made].sum()/total)
        values[cat]=(b[made]-baseline[cat]*b[attempt]).where(valid)
    z=pd.DataFrame(index=b.index)
    for cat in CATS:
        if cat not in values:continue
        v=values[cat]
        if v.count()<3:unavailable[cat]='Fewer than three observed values';continue
        sd=float(v.std(ddof=0))
        if not math.isfinite(sd) or sd<=1e-12:unavailable[cat]='No observed variation';continue
        z[cat]=(v-v.mean())/sd
    if z.empty:raise ValueError('No category has enough verified variation')
    return Evaluation(b,z,tuple(z.columns),unavailable,baseline,len(b),unavailable_rows)

def roster_profile(model,ids):
    ids=list(dict.fromkeys(map(yahoo_id,ids)))
    missing=set(ids)-set(model.board.index)
    if missing:raise ValueError('Roster IDs missing from source: '+', '.join(sorted(missing)))
    rows=model.board.loc[ids];zs=model.z.loc[ids]
    total={}
    for cat in COUNTS:
        total[cat]=float(rows[cat].sum()) if cat in rows and rows[cat].notna().all() else None
    for pre in ('FG','FT'):
        made,att=pre+'M',pre+'A'
        total[pre+'%']=float(rows[made].sum()/rows[att].sum()) if made in rows and att in rows and rows[[made,att]].notna().all().all() and rows[att].sum()>0 else None
    # Sum relative player contributions; not a team win probability.
    contributions={c:float(zs[c].sum()) if zs[c].notna().all() else None for c in model.categories}
    return {'count':len(ids),'totals_per_game':total,'z_sum':contributions,
            'strong':sorted([c for c,v in contributions.items() if v is not None and v>0],key=lambda c:-contributions[c]),
            'weak':sorted([c for c,v in contributions.items() if v is not None and v<0],key=lambda c:contributions[c])}

def punt_strategies(model,early_ids,max_punts=2,penalty=.25):
    ids=list(dict.fromkeys(map(yahoo_id,early_ids)))[:2]
    if not ids:return []
    profile=roster_profile(model,ids)
    # Incomplete anchor data must not silently produce an 'optimal' strategy.
    if any(v is None for v in profile['z_sum'].values()):return []
    out=[]
    for n in range(max_punts+1):
        for punts in combinations(model.categories,n):
            keep=[c for c in model.categories if c not in punts]
            if len(keep)<5:continue
            score=sum(profile['z_sum'][c]/len(ids) for c in keep)/len(keep)-penalty*n
            out.append({'punt':punts,'score':float(score),'retained':tuple(keep),'anchors':ids,'provisional':len(ids)<2})
    return sorted(out,key=lambda x:(-x['score'],len(x['punt']),x['punt']))

def infer_slot(picks,ours,teams=12):
    owned=set(map(yahoo_id,ours));slots=set()
    for p in picks:
        if yahoo_id(p['player_id']) not in owned:continue
        rnd=(p['pick']-1)//teams+1;within=(p['pick']-1)%teams+1
        slots.add(within if rnd%2 else teams+1-within)
    if len(slots)>1:raise ValueError('Own picks conflict with a standard snake draft')
    return next(iter(slots)) if slots else None

def next_picks(current,slot,teams=12):
    if not isinstance(current,int) or current<1 or not 1<=slot<=teams:raise ValueError('Invalid current pick or slot')
    found=[];rnd=(current-1)//teams+1
    while len(found)<2:
        p=(rnd-1)*teams+(slot if rnd%2 else teams+1-slot)
        if p>=current:found.append(p)
        rnd+=1
    return tuple(found)

def recommend(model,roster_ids,drafted_ids,current,slot,punts=(),limit=4):
    ours=list(dict.fromkeys(map(yahoo_id,roster_ids)))
    drafted=set(map(yahoo_id,drafted_ids))|set(ours)
    unknown=set(ours)-set(model.board.index)
    if unknown:raise ValueError('Roster data incomplete; recommendations paused')
    keep=[c for c in model.categories if c not in punts]
    if len(keep)<5:raise ValueError('At least five verifiable retained categories are required')
    profile=roster_profile(model,ours)
    if any(profile['z_sum'][c] is None for c in keep):raise ValueError('Roster category data missing')
    weights=pd.Series({c:1+min(2,max(0,-profile['z_sum'][c]/max(1,len(ours)))) for c in keep})
    eligible=model.z[keep].notna().all(axis=1)&~model.board.index.isin(drafted)
    z=model.z.loc[eligible,keep];b=model.board.loc[eligible]
    pick,nextpick=next_picks(current,slot)
    if b.empty:return []
    fit=z.mul(weights).sum(axis=1)/weights.sum()
    protected=[c for c in profile['strong'] if c in keep][:3]
    for c in protected:
        if c in keep:fit=fit+z[c].clip(upper=0)/len(keep)
    adp=b['ADP_AVG'] if 'ADP_AVG' in b else b.get('ADP_RANK',pd.Series(index=b.index,dtype=float))
    future=fit[adp>=nextpick]
    scores={}
    for pid in b.index:
        alternatives=future.drop(pid,errors='ignore')
        # Two-step retained-category utility. ADP is a threshold, not a survival probability.
        scores[pid]=float(fit[pid]+(alternatives.max() if len(alternatives) else 0))
    ordered=sorted(b.index,key=lambda i:(-scores[i],-fit[i],float(adp[i]) if pd.notna(adp[i]) else float('inf'),i))
    out=[]
    for i,pid in enumerate(ordered[:limit]):
        value=float(adp[pid]) if pd.notna(adp[pid]) else None
        boosts=sorted([c for c in keep if z.loc[pid,c]>0],key=lambda c:-z.loc[pid,c])[:3]
        out.append({'role':'Must Pick' if i<2 else 'Backup','YAHOO_ID':pid,'PLAYER':str(b.loc[pid,'PLAYER']),
                    'ADP':value,'fit':float(fit[pid]),'two_pick_value':scores[pid],'future_candidates':int(len(future.drop(pid,errors='ignore'))),'strengthens':boosts,
                    'protect':protected,'hurts_protected':[c for c in protected if c in keep and z.loc[pid,c]<0],
                    'wait':('판단 불가: ADP 없음' if value is None else '다음 픽 전 지명 위험: ADP 기준' if value<nextpick else '평균 ADP상 대기 후보: 잔존 보장 없음'),
                    'current_my_pick':pick,'next_my_pick':nextpick,'active_categories':keep})
    return out
