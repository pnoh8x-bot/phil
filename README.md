# NBA Fantasy Draft Helper — Cloud MVP

A Python + Streamlit prototype for 12-team H2H 9-category snake draft planning.

## Current status
- Uploaded verified XLSX/CSV DraftBoard is the only player-data source.
- Calculates snake-draft pick numbers and displays ADP-based candidates.
- Tracks manually selected players and computes projected counting-stat totals.
- Team FG% / FT% are computed only when FGM/FGA and FTM/FTA exist.
- Yahoo OAuth, real-time draft synchronization, automatic player entry, persistent cloud state, and dynamic punt optimizer **are not implemented**.
- ADP proximity is not confirmation that a player is undrafted.

## Local run
```bash
python -m pip install -r requirements.txt
streamlit run app.py
```

## Tests
```bash
pip install pytest
pytest -q
```

## Render deployment
1. Connect this GitHub repository to Render.
2. Use Render Blueprint with `render.yaml` (starter paid plan).
3. Deploy and verify the health check.
4. Do not upload Yahoo passwords or OAuth tokens to GitHub.

## Security
This repository is currently public. Do not commit credentials, private Yahoo drafts, or sensitive league data. Access control is required before using personal league data on a publicly accessible deployment.

## Roadmap
1. Confirm Yahoo Fantasy API permissions and actual in-progress draft data access.
2. Add secure Yahoo OAuth, event polling/webhook as supported, and manual sync fallback.
3. Persistent database + authentication.
4. Punt-adjusted 9CAT z-scores, ADP opportunity cost and next-pick-aware recommendations.
5. Real draft-day testing before relying on live recommendations.


## API-free Yahoo browser sync (preview)

The optional Chrome/Edge extension in `browser-extension/` reads rendered Yahoo basketball tables. It does not call the Yahoo API, read cookies, save passwords, or submit draft picks. Download `browser-extension.zip` from the app and follow `browser-extension/README.md`.

Supported sources: current-season round Draft Results tables, displayed player statistics, displayed Avg Pick, league settings and team labels. Historical results are rejected. Draft Results is reloaded every 15 seconds after the scheduled-draft notice disappears; this is not a promise of real-time Yahoo publishing. Live draft-room DOM support has not been field-tested. Keep the extension and Yahoo/Helper tabs open. Only visited player/ADP pages are collected, so an uploaded verified DraftBoard remains the most complete source. No private league/account data is committed to this repository.

Run Python checks: `python tests/run_checks.py`. Browser parser fixtures: serve the repository locally and open `tests/parser-fixture.html`. Six Python checks and five browser fixture checks cover wrong season/league, duplicate/missing picks, identity matching, within-round numbering and ADP provenance. Actual in-draft latency and Chrome extension installation remain to be verified on the user's browser.


### Live draft-room DOM adapter

The Yahoo live draft room layout was inspected in a free mock draft. The adapter supports displayed `.ys-player[data-id]` identity, visible ADP/projection columns and Results > Round by Round overall-pick rows. Keep the Results view open for pick updates; switching views stops results capture and the Helper shows a stale-data warning. Mock rooms require explicit room binding so a mock draft cannot silently overwrite the real league. Source URLs exclude auth query parameters. Eight browser parser fixture checks pass; full Chrome/Edge extension installation and live production-league transfer are still pending user setup. This is a browser-sync preview, not a verified zero-latency draft feed.
