import unittest
from contextlib import contextmanager
import pandas as pd
from yahoo_sync import validate_snapshot, match_picks, browser_board

class Raises:
    @staticmethod
    @contextmanager
    def raises(error):
        try: yield
        except error: return
        raise AssertionError('Expected '+error.__name__)
pytest=Raises()

def sample(picks=None):
    return dict(version=1,league_id='123',season=2026,picks=picks or [])

def pick(n=1,pid='1',name='Nikola Jokić',team='Mine'):
    return dict(pick=n,player_id=pid,player=name,team=team)

def test_wrong_league_and_old_season_are_rejected():
    with pytest.raises(ValueError):validate_snapshot(sample(),'999',2026)
    with pytest.raises(ValueError):validate_snapshot(sample(),'123',2025)

def test_partial_and_duplicate_history():
    assert not validate_snapshot(sample([pick(2)]),'123',2026)['complete_pick_sequence']
    with pytest.raises(ValueError):validate_snapshot(sample([pick(),pick()]),'123',2026)

def test_identity_and_diacritics_match_without_guessing():
    board=pd.DataFrame({'PLAYER':['Nikola Jokic','Other'],'YAHOO_ID':['1','2']})
    ours,others,missing=match_picks(board,[pick(),pick(2,'3','Unknown')],'Mine')
    assert ours==['Nikola Jokic'] and not others and missing==['Unknown']

def test_no_adp_from_yahoo_rank_and_missing_stats_stay_missing():
    assert browser_board({'board':[{'PLAYER':'A','ADP_RANK':1}]}) is None
    row={'PLAYER':'A','YAHOO_ID':'1','ADP_AVG':2.3,'ADP_RANK':1,**{k:None for k in ['PTS','REB','AST','STL','BLK','3PM','FG%','FT%','TO']}}
    result=browser_board({'board':[row]})
    assert result.iloc[0]['ADP_AVG']==2.3 and pd.isna(result.iloc[0]['PTS'])

if __name__=='__main__':
    suite=unittest.TestSuite(unittest.FunctionTestCase(v) for k,v in list(globals().items()) if k.startswith('test_'))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())
