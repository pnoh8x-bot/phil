"""Streamlit UI integration with explicit synthetic projections and observations."""
from pathlib import Path
from unittest.mock import patch
from streamlit.testing.v1 import AppTest
from test_recommendations import fixture,snapshot

def run_ui(age=0,drop_rates=False,missing_own=False):
    at=AppTest.from_file(str(Path(__file__).parents[1]/'app.py'))
    at.session_state['config']={'league_id':'123','team_id':'9','season':2026}
    raw=snapshot(age);raw['revision']=7
    at.session_state['snapshot']=raw;at.session_state['ack_revision']=7
    b=fixture()
    if drop_rates:b=b.drop(columns=['FGM','FGA','FTM','FTA'])
    if missing_own:b=b[b.YAHOO_ID!='3']
    at.session_state['board_override']=b.to_dict('records')
    with patch('streamlit.components.v1.declare_component',return_value=lambda **kw:None):at.run()
    assert not at.exception
    return at

def test_ui_displays_four_unique_cards_and_two_snake_picks():
    at=run_ui();cards=[x.value for x in at.markdown if 'Yahoo ID' in x.value]
    assert len(cards)==4 and sum('Must Pick' in x for x in cards)==2 and sum('Backup' in x for x in cards)==2
    assert not any('Yahoo ID 3' in x for x in cards)
    assert any('22 → 그다음 27' in x.value for x in at.markdown)

def test_ui_stale_history_stops_recommendation_cards():
    at=run_ui(age=90)
    assert any('추천 일시 중지' in x.value for x in at.warning)
    assert not any('Yahoo ID' in x.value for x in at.markdown)

def test_ui_discloses_missing_shot_volumes_and_seven_category_mode():
    at=run_ui(drop_rates=True)
    assert any('FG%' in x.value and 'FT%' in x.value for x in at.warning)
    assert any('7/9' in x.value for x in at.caption)

def test_ui_unknown_roster_identity_blocks_cards():
    at=run_ui(missing_own=True)
    assert any('Roster IDs missing' in x.value for x in at.error)
    assert not any('Yahoo ID' in x.value for x in at.markdown)

def test_ui_empty_connection_never_shows_recommendations():
    with patch('streamlit.components.v1.declare_component',return_value=lambda **kw:None):
        at=AppTest.from_file(str(Path(__file__).parents[1]/'app.py')).run()
    assert not at.exception and any('수신을 기다립니다' in x.value for x in at.info)

