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
