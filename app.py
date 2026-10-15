"""NBA Draft Helper with an opt-in browser-only Yahoo bridge."""
import json, re
from datetime import datetime, timezone
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components
from draft_engine import snake_pick, read_board, candidate_pool, team_totals
from yahoo_sync import validate_snapshot, browser_board, match_picks

st.set_page_config(page_title="NBA Draft Helper",layout="wide")
st.title("NBA Fantasy Draft Helper")
st.caption("9CAT · Yahoo API 없이 브라우저 화면 연결 · 지명 실행은 Yahoo에서 직접")
bridge=components.declare_component("yahoo_browser_bridge",path=str(Path(__file__).parent/"browser_bridge"))
with st.expander("Yahoo 브라우저 연결",expanded=True):
    st.write("Chrome/Edge 확장 프로그램이 로그인된 Yahoo의 표를 읽어 이 앱에 전달합니다. Yahoo 비밀번호·쿠키는 전송하지 않습니다.")
    ext=Path(__file__).parent/"browser-extension.zip"
    if ext.exists(): st.download_button("브라우저 연결 확장 다운로드",ext.read_bytes(),file_name="nba-yahoo-sync.zip")
    st.caption("압축 해제 → chrome://extensions 또는 edge://extensions → 개발자 모드 → 압축해제된 확장 로드. 확장에서 Yahoo 팀 주소를 입력한 뒤 이 앱과 Yahoo 탭을 새로고침하세요.")
    st.caption("라이브 드래프트 방 직접 인식은 미검증입니다. 현재 Draft Results 표를 15초마다 갱신합니다. Yahoo가 결과를 늦게 반영하면 이 앱도 늦게 갱신됩니다.")
    team_url=st.text_input("Yahoo 팀 주소",placeholder="https://basketball.fantasysports.yahoo.com/nba/리그번호/팀번호")
    match=re.fullmatch(r"https://basketball\.fantasysports\.yahoo\.com/nba/(\d+)/(\d+)/?",team_url.strip())
    season=st.number_input("연결 시즌 시작 연도",2020,2100,datetime.now().year)
    raw=bridge(league_id=match[1],season=season,key="yahoo-bridge",default=None) if match else None
    imported=st.file_uploader("브라우저 연결 파일 가져오기 (선택)",type=["json"])
    if imported:
        try: raw=json.loads(imported.getvalue())
        except (ValueError,UnicodeDecodeError):st.error("올바른 JSON 파일이 아닙니다.")
snapshot=None
if raw and match:
    try:
        snapshot=validate_snapshot(raw,match[1],season)
        st.info(f"Yahoo 화면 수신: {snapshot.get('captured_at','')} · 현재 시즌 지명 {len(snapshot['picks'])}개")
        if snapshot.get("draft_status"):st.write(snapshot["draft_status"])
    except (ValueError,TypeError) as e:st.error(str(e))
uploaded=st.file_uploader("DraftBoard (.xlsx 또는 .csv) — 브라우저에서 통계·ADP를 수집했으면 생략 가능",type=["xlsx","csv"])
board=None
try:
    if uploaded:board=read_board(uploaded.getvalue(),uploaded.name)
    elif snapshot:board=browser_board(snapshot)
except ValueError as e:st.error(str(e))
if board is None:
    st.info("Yahoo 선수 목록의 통계와 Draft Analysis의 Avg Pick을 브라우저 연결로 수집하거나 검증된 DraftBoard를 올려주세요. ADP를 Yahoo 순위로 대체하지 않습니다.")
    st.stop()
if not uploaded:
    sources=sorted(set(board["STAT_SOURCE"].dropna())) if "STAT_SOURCE" in board else []
    st.caption(f"브라우저에서 읽은 선수 {len(board)}명 · 통계 기준: {', '.join(sources)}. 수집된 선수만 포함됩니다.")
teams=st.number_input("실제 드래프트 참가 팀 수",2,30,int((snapshot or {}).get("draft_teams") or 12))
if snapshot and snapshot.get("settings",{}).get("Max Teams"):
    st.caption("리그 최대 팀 수: "+snapshot["settings"]["Max Teams"]+" · 최대 팀 수와 실제 참가 팀 수는 다를 수 있습니다.")
slot=st.number_input("내 지명 순번 (팀 ID와 다름)",1,int(teams),value=None,placeholder="Yahoo에서 순서가 정해진 뒤 입력")
ours=[];others=[]
auto=snapshot is not None and st.checkbox("Yahoo 결과 표로 지명 현황 반영",value=True)
if auto:
    pickteams=sorted({p["team"] for p in snapshot["picks"]})
    linked={str(t["id"]):t["name"] for t in snapshot.get("teams",[])}
    teamname=linked.get(match[2])
    if not teamname and pickteams:teamname=st.selectbox("결과 표에서 내 팀 선택",pickteams,index=None)
    if snapshot["picks"] and not teamname:st.warning("내 팀을 확인해야 내 명단을 나눌 수 있습니다.")
    ours,others,missing=match_picks(board,snapshot["picks"],teamname)
    if missing:st.warning("DraftBoard에서 찾지 못한 지명 선수: "+", ".join(missing))
    if snapshot["picks"] and snapshot["complete_pick_sequence"]:
        overall=max(p["pick"] for p in snapshot["picks"])+1
        rnd=(overall-1)//int(teams)+1
        st.write(f"결과 표 기준 다음 전체 지명: {overall} · {rnd}라운드")
    else:rnd=st.number_input("현재 라운드 (결과 표 미확인)",1,30,1)
    if not snapshot["complete_pick_sequence"]:st.warning("지명 기록에 공백이 있습니다. 현재 픽을 자동 추정하지 않습니다.")
    try:
        age=(datetime.now(timezone.utc)-datetime.fromisoformat(snapshot.get("picks_at","").replace("Z","+00:00"))).total_seconds()
        if age>45:st.warning("결과 수신이 45초 이상 지났습니다. Yahoo 결과 탭과 확장을 확인하세요.")
    except (ValueError,TypeError):st.caption("결과 표 수신 시간은 아직 확인되지 않았습니다.")
    st.write("내 명단:",", ".join(ours) or "아직 확인된 지명 없음")
else:
    rnd=st.number_input("현재 라운드",1,30,1)
    names=board["PLAYER"].tolist()
    ours=st.multiselect("내 지명 선수",names)
    others=st.multiselect("다른 팀 지명 선수",[n for n in names if n not in ours])
window=st.number_input("ADP 후보 범위",0,100,7)
if slot is not None:
    pick=snake_pick(int(rnd),int(slot),int(teams))
    st.markdown(f"### 내 이번 라운드 전체 픽 **{pick}** → 다음 **{snake_pick(int(rnd)+1,int(slot),int(teams))}**")
    pool=candidate_pool(board,pick,ours,others,window=int(window))
else:
    pool=board[~board["PLAYER"].isin(ours+others)].copy()
    st.info("내 지명 순번이 아직 정해지지 않았습니다. 아래는 수집된 ADP 순서이며 실시간 미지명 보장이 아닙니다.")
st.subheader("후보 선수 · 출처 ADP 순")
st.caption("결과 수신 지연·누락이 있으면 이미 지명된 선수가 남아 있을 수 있습니다.")
view=[c for c in ["PLAYER","TEAM","POS","ADP_AVG","ADP_RANK","Pick_gap","PTS","REB","AST","STL","BLK","3PM","FG%","FT%","TO"] if c in pool]
st.dataframe(pool[view],hide_index=True,use_container_width=True)
st.subheader("내 팀 누적 통계 · 원본 데이터 단위")
if ours:st.json(team_totals(board,ours))
st.download_button("드래프트 상태 저장",json.dumps({"slot":slot,"teams":teams,"round":int(rnd),"ours":ours,"others":others},ensure_ascii=False,indent=2),file_name="draft-state.json")
st.caption("Yahoo API 승인 불필요 · 화면 기반 보조 기능 · 자동 지명·펀트 최적화·기기 간 저장은 미구현")

