"""NBA Fantasy Draft Helper: local-data-first cloud prototype."""
import json
import streamlit as st
from draft_engine import snake_pick, read_board, candidate_pool, team_totals

st.set_page_config(page_title="NBA Draft Helper", layout="wide")
st.title("NBA Fantasy Draft Helper")
st.caption("12-team H2H 9CAT · strictly uploaded-source ADP · prototype, not Yahoo-connected")
uploaded = st.file_uploader("Upload verified new-season DraftBoard (.xlsx or .csv)", type=["xlsx","csv"])
if not uploaded:
    st.info("Upload a DraftBoard to begin. No player ADP or statistics will be invented.")
    st.stop()
try:
    board = read_board(uploaded.getvalue(), uploaded.name)
except ValueError as e:
    st.error(str(e))
    st.stop()

c1,c2,c3 = st.columns(3)
with c1: slot=st.number_input("Draft slot", 1, 12, 3)
with c2: rnd=st.number_input("Current round", 1, 30, 1)
with c3: window=st.number_input("ADP window", 0, 100, 7)
pick=snake_pick(rnd, slot)
st.markdown(f"### Overall pick **{pick}** → next **{snake_pick(rnd+1,slot)}**")
names=board["PLAYER"].tolist()
ours=st.multiselect("My roster (manually entered in this MVP)", names)
others=st.multiselect("Drafted by other teams", [n for n in names if n not in ours])
confirmed_mode=st.checkbox("I know which players remain available")
confirmed=st.multiselect("Confirmed available", [n for n in names if n not in ours and n not in others]) if confirmed_mode else None
pool=candidate_pool(board,pick,ours,others,confirmed,window)
st.subheader("Candidate board · sorted by source ADP")
view=[c for c in ["PLAYER","TEAM","POS","ADP_RANK","Pick_gap","Availability","PTS","REB","AST","STL","BLK","3PM","FG%","FT%","TO"] if c in pool.columns]
st.dataframe(pool[view],hide_index=True,use_container_width=True)
st.subheader("Team totals · original projection units")
if ours:
    totals=team_totals(board,ours)
    st.json(totals)
    if totals["FG%"] is None or totals["FT%"] is None:
        st.caption("Accurate combined FG%/FT% requires FGM/FGA and FTM/FTA; percentages alone cannot be averaged.")
else:
    st.write("Select drafted players to see team totals.")
st.download_button("Export draft state",data=json.dumps({"slot":slot,"round":rnd,"ours":ours,"others":others,"confirmed_available":confirmed},ensure_ascii=False,indent=2),file_name="draft-state.json")
st.warning("Yahoo automatic roster/draft sync, secure multi-device persistence and punt optimization are not implemented. No real-time availability is claimed.")
