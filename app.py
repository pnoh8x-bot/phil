"""Browser-observed, file-grounded 12-team H2H draft assistant."""
import json,re
from datetime import datetime
from pathlib import Path
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from draft_engine import read_board
from yahoo_sync import browser_board
from draft_state import derive_state
from recommendations import evaluate_board,roster_profile,punt_strategies,recommend

st.set_page_config(page_title='NBA Draft Helper',layout='wide')
st.title('NBA Fantasy Draft Helper')
st.caption('12팀 H2H · 9CAT · 스네이크 · Yahoo 화면 자동 동기화')
bridge=components.declare_component('yahoo_browser_bridge',path=str(Path(__file__).parent/'browser_bridge'))
cfg=st.session_state.get('config',{})
with st.expander('브라우저 연결 · 최초 설정',expanded=not bool(cfg)):
    st.write('확장을 설치한 같은 Chrome/Edge에서 Yahoo와 이 앱을 열어두세요. 지명은 Yahoo에서 직접 합니다. 드래프트 탭은 하나만 유지하고 Results → Round by Round가 표시될 때 결과를 수집합니다.')
    ext=Path(__file__).parent/'browser-extension.zip'
    if ext.exists():st.download_button('확장 프로그램 다운로드',ext.read_bytes(),file_name='nba-yahoo-sync.zip')
    st.caption('압축 해제 → chrome://extensions → 개발자 모드 → 압축해제된 확장 로드 → 확장에 팀 주소 입력 → Yahoo와 Helper 새로고침. 모의 방은 방 주소도 입력하세요.')
    url=st.text_input('Yahoo 팀 주소',value=cfg.get('team_url',''),placeholder='https://basketball.fantasysports.yahoo.com/nba/30375/9')
    match=re.fullmatch(r'https://basketball\.fantasysports\.yahoo\.com/nba/(\d+)/(\d+)/?',url.strip())
    year=st.number_input('시즌 시작 연도',2020,2100,int(cfg.get('season',datetime.now().year)))
    desired={'league_id':match[1],'team_id':match[2],'season':int(year)} if match else cfg

restore=st.session_state.pop('restore_packet',None)
if restore:desired=restore['config']
packet=bridge(league_id=desired.get('league_id'),team_id=desired.get('team_id'),season=desired.get('season'),
              ack_revision=st.session_state.get('ack_revision'),board_to_save=st.session_state.get('board_override'),
              board_basis=st.session_state.get('board_basis'),board_scope=cfg,restore_packet=restore,key='yahoo-bridge',default=None)
if isinstance(packet,dict) and isinstance(packet.get('config'),dict):
    incoming=packet['config'];scope=(incoming.get('league_id'),incoming.get('season'))
    if cfg and (scope!=(cfg.get('league_id'),cfg.get('season')) or incoming.get('team_id')!=cfg.get('team_id')):
        for key in ('board_override','board_basis','snapshot','ack_revision'):st.session_state.pop(key,None)
    st.session_state.config=incoming
    if packet.get('snapshot'):st.session_state.snapshot=packet['snapshot']
    if packet.get('board_override') and not st.session_state.get('board_override'):
        st.session_state.board_override=packet['board_override'];st.session_state.board_basis=packet.get('board_basis')

with st.expander('검증된 통계 파일 · 백업'):
    st.caption('현재 시즌·동일 기준의 CSV/XLSX만 사용하세요. Yahoo ID와 STAT_BASIS(per_game 또는 season_total)가 필요합니다. FG/FT 평가에는 FGM/FGA/FTM/FTA가 필요합니다.')
    uploaded=st.file_uploader('DraftBoard 파일',type=['csv','xlsx'])
    if uploaded:
        try:
            b=read_board(uploaded.getvalue(),uploaded.name);evaluate_board(b)
            records=json.loads(b.to_json(orient='records'))
            if records!=st.session_state.get('board_override'):
                st.session_state.board_override=records;st.session_state.board_basis=None;st.rerun()
        except (ValueError,TypeError) as e:st.error('파일 검증 실패: '+str(e))
    st.caption('같은 브라우저에 자동 저장됩니다. 저장소 삭제·다른 기기에는 이어지지 않으므로 백업을 보관하세요. Render 임시 디스크에 의존하지 않습니다.')
    backup={k:st.session_state.get(k) for k in ('config','snapshot','board_override','board_basis')}
    st.download_button('전체 상태 백업',json.dumps(backup,ensure_ascii=False,allow_nan=False),file_name='nba-draft-state.json')
    restored=st.file_uploader('내 백업 복원',type=['json'])
    if restored and st.button('검증 후 복원'):
        try:
            v=json.loads(restored.getvalue());c=v['config']
            derive_state(v['snapshot'],c['league_id'],c['season'],c['team_id'])
            if v.get('board_override'):evaluate_board(pd.DataFrame(v['board_override']),v.get('board_basis'))
            st.session_state.restore_packet=v;st.rerun()
        except (ValueError,TypeError,KeyError) as e:st.error('백업 검증 실패: '+str(e))

raw=st.session_state.get('snapshot');cfg=st.session_state.get('config',{})
if raw and cfg:
    try:
        derive_state(raw,cfg['league_id'],cfg['season'],cfg['team_id'])
        revision=raw.get('revision')
        if revision and revision!=st.session_state.get('ack_revision'):
            st.session_state.ack_revision=revision;st.rerun()
    except (ValueError,TypeError,KeyError) as e:st.error('동기화 검증 실패: '+str(e))

@st.fragment(run_every='5s')
def dashboard():
    raw=st.session_state.get('snapshot');c=st.session_state.get('config',{})
    if not raw or not c:
        st.info('Yahoo 관찰 수신을 기다립니다. 확장을 설정하고 연결 시작을 눌러주세요.');return
    try:
        state=derive_state(raw,c['league_id'],c['season'],c['team_id'])
        st.info(f"리그 {c['league_id']} · 수신 버전 {raw.get('revision','—')} · 지명 {len(state['drafted'])}명 · 내 순번 {state['slot'] or '미확인'} · 현재 전체 픽 {state['current'] or '미확인'}")
        if raw.get('connection_error'):
            st.error(raw['connection_error']);return
        age=state['age_seconds'];st.caption('결과 표 수신: '+(f'{max(0,int(age))}초 전' if age is not None else '미확인'))
        if not state['ready']:
            st.warning('추천 일시 중지 · 아래 미확인 항목이 해결되면 자동으로 다시 계산합니다.')
            for reason in state['pause_reasons']:st.write('• '+reason['message'])
        with st.expander('동기화 상세'):
            st.write(f"현재 전체 픽: {state['current'] or '미확인'} · 수집 결과의 다음 픽: {state['history_next']} · 내 순번: {state['slot'] or '미확인'}")
            st.write('이력 연결: '+('확인' if state['snapshot']['complete_pick_sequence'] else '누락 있음')+' · 마지막 결과 관찰 검증: '+('확인' if state['snapshot'].get('history_complete',True) else '미완료'))
        rows=st.session_state.get('board_override');board=pd.DataFrame(rows) if rows else browser_board(raw)
        if board is None:
            st.warning('선수 통계가 없습니다. Yahoo 선수 표를 열거나 검증된 통계 파일을 연결하세요.');return
        sources=sorted(set(board['STAT_SOURCE'].dropna().astype(str))) if 'STAT_SOURCE' in board else []
        st.caption('통계 출처 기준: '+(', '.join(sources) or '검증 파일의 STAT_BASIS'))
        prior_source=any(re.search(r'20\d{2}',src) and int(re.search(r'20\d{2}',src)[0])!=int(c['season']) for src in sources)
        if not rows and (prior_source or 'STAT_SEASON' in board and (pd.to_numeric(board.STAT_SEASON,errors='coerce')!=int(c['season'])).any()):
            st.error('통계 시즌이 연결 시즌과 다릅니다. Yahoo 통계 선택을 현재 시즌으로 바꾸세요. 지난 시즌 수치를 현재 예측으로 사용하지 않습니다.');return
        model=evaluate_board(board,st.session_state.get('board_basis'))
        st.caption(f"평가 모집단: 수집/파일 선수 {model.population}명 · 평가 가능 {len(model.categories)}/9 카테고리 · 전체 NBA 선수 수집을 보장하지 않습니다.")
        if model.unavailable:
            descriptions={k:('슛 성공·시도 수가 없어 평가 불가' if k in ('FG%','FT%') and 'volume missing' in v else v) for k,v in model.unavailable.items()}
            st.warning('평가 제외: '+' / '.join(k+': '+v for k,v in descriptions.items()))
            if any('volume missing' in v for v in model.unavailable.values()):
                st.caption('9CAT 전체 평가에는 Yahoo 일반 Players 화면의 Stats → Remaining Games (proj)에서 FGM/A·FTM/A를 수집하거나 검증된 통계 파일을 연결하세요. 드래프트 방을 복제하지 않고 일반 선수 목록을 이용합니다.')
        if model.normalization_unavailable:st.warning('GP가 0이거나 없어 경기당 통계를 계산할 수 없는 선수는 추천에서 제외합니다. Yahoo ID: '+', '.join(model.normalization_unavailable))
        profile=roster_profile(model,state['ours'])
        st.subheader('내 로스터 · 누적 카테고리')
        owned=model.board.loc[state['ours']];st.write(', '.join(owned.PLAYER) if len(owned) else '아직 지명한 선수 없음')
        if len(owned):
            st.write('강점: '+(', '.join(profile['strong']) or '없음')+' · 약점: '+(', '.join(profile['weak']) or '없음'))
            st.dataframe(pd.DataFrame([{'카테고리':cat,'경기당 합계 / 가중 성공률':profile['totals_per_game'].get(cat),'Z 합':profile['z_sum'].get(cat)} for cat in ('PTS','REB','AST','STL','BLK','3PM','FG%','FT%','TO')]),hide_index=True)
        first=[p['player_id'] for p in state['snapshot']['picks'] if p['player_id'] in state['ours'] and p['pick']<=24]
        strategies=punt_strategies(model,first);punts=strategies[0]['punt'] if strategies else ()
        st.subheader('초반 조합 기반 펀트 전략')
        if strategies:
            st.write(('1명 기준 잠정 전략: ' if strategies[0]['provisional'] else '1–2라운드 조합의 모델 내 최상위 전략: ')+(', '.join(punts) or '균형 유지'))
            st.dataframe(pd.DataFrame([{'펀트':', '.join(p['punt']) or '없음','평가점수':p['score'],'유지':', '.join(p['retained'])} for p in strategies[:5]]),hide_index=True)
        else:st.caption('초반 지명 조합과 검증된 통계가 모이면 계산합니다.')
        if not state['ready']:
            return
        recs=recommend(model,state['ours'],state['drafted'],state['current'],state['slot'],punts)
        st.subheader('다음 추천 · Must Pick 2 / Backup 2')
        if not recs:st.warning('검증된 미지명 후보가 없습니다.');return
        st.write(f"내 다음 전체 픽 {recs[0]['current_my_pick']} → 그다음 {recs[0]['next_my_pick']}")
        for rec in recs:
            with st.container(border=True):
                st.markdown(f"**{rec['role']} · {rec['PLAYER']}** · Yahoo ID {rec['YAHOO_ID']}")
                st.write('ADP: '+(f"{rec['ADP']:.1f}" if rec['ADP'] is not None else '자료 없음')+' · 강화: '+(', '.join(rec['strengthens']) or '없음'))
                st.write('유지할 강점: '+(', '.join(rec['protect']) or '아직 없음')+' · 강점 훼손: '+(', '.join(rec['hurts_protected']) or '없음'))
                st.caption(rec['wait'])
                if not rec['future_candidates']:st.caption('그다음 픽까지 남을 ADP 후보 자료가 없어 2단계 보너스를 적용하지 않았습니다.')
    except (ValueError,TypeError,KeyError) as e:st.error('추천 검증 실패: '+str(e))

dashboard()
with st.expander('평가 기준과 한계'):
    st.write('Z-score는 검증된 수집 모집단의 평균·모표준편차를 사용합니다. TO는 낮을수록 좋고 FG/FT는 성공 수 − 모집단 성공률 × 시도 수로 평가합니다. 시즌 합계는 GP로 나눕니다. 비어 있는 수치를 채우지 않습니다.')
    st.write('펀트는 없음/1개/2개를 비교해 유지 카테고리의 초반 평균 Z − 펀트당 0.25로 정렬합니다. 최소 5개를 유지합니다. 명시된 점수식의 최적값이며 리그 승률의 최적해가 아닙니다.')
    st.write('추천은 로스터 약점 보완·상위 강점 보호·다음 스네이크 픽까지의 ADP 후보 가치를 합산합니다. ADP는 평균 순서이며 실제 잔존 확률이 아닙니다. Must Pick도 자동 지명 명령은 아닙니다.')
