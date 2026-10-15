import pandas as pd
from draft_engine import snake_pick,candidate_pool,read_board,team_totals

def test_snake():
    assert [snake_pick(i,3) for i in range(1,6)] == [3,22,27,46,51]

def test_adp_and_missing_efficiency():
    df=pd.DataFrame([{"PLAYER":"A","ADP_RANK":20,"PTS":1,"REB":2,"AST":3,"STL":4,"BLK":5,"3PM":6,"FG%":.55,"FT%":.8,"TO":2},{"PLAYER":"B","ADP_RANK":21,"PTS":2,"REB":3,"AST":4,"STL":5,"BLK":6,"3PM":7,"FG%":.6,"FT%":.9,"TO":1}])
    b=read_board(df.to_csv(index=False).encode(),"test.csv")
    assert candidate_pool(b,22,["A"],[]).iloc[0]["PLAYER"]=="B"
    assert team_totals(b,["A"])["FG%"] is None
