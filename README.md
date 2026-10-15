# NBA Draft Helper

12-team H2H 9CAT snake draft assistant. Yahoo API access is not required. Draft actions remain in Yahoo.

## Implemented

- Chrome/Edge MV3 extension reads visible Yahoo tables and player IDs. A service worker serializes observations into league/season-scoped `chrome.storage.local`, retaining a previous snapshot. Complete results can replace history (including undo); partial/virtualized observations cannot erase history and pause recommendations.
- Extension → Streamlit iframe transport with revision ACK shown in the extension popup. Receiving a message is distinguished from observing Yahoo and from validating recommendation inputs.
- Exact canonical Yahoo ID exclusions, roster ownership and snake-slot inference. No name fallback in the recommendation engine. Stale (>45s), incomplete, conflicting, wrong-season and wrong-league observations stop recommendations. Team IDs are never treated as draft slots.
- Population Z-scores (ddof=0), lower-is-better TO, and volume-weighted FG/FT impact (`made − population_rate × attempts`). Season totals normalize by positive GP. Unknown/mixed units, invalid numbers and duplicate IDs are rejected. Missing statistics remain missing.
- Punt search across no punt, one punt and two punts, keeping at least five observed categories. Only actual round 1–2 selections anchor the strategy. A single anchor is provisional. Score = mean retained anchor Z minus 0.25 per punt; this optimizes that declared heuristic, not a measured league win probability.
- Unique Must Pick 2 and Backup 2, or fewer if insufficient verified candidates. Roster weakness weights, protection of up to three retained strengths, and two-pick utility use the next two own snake picks. The second-step pool uses observed ADP ≥ next own pick; absent future data adds no bonus. ADP is not a survival probability.
- Player ADP, boosted categories, strengths to protect, damage to strengths and ADP-based waiting explanation. No invented probabilities or fake NBA projections.
- Cumulative per-game counting categories, shot-weighted team percentages, category Z sums and strengths/weaknesses.
- Same-browser persistent state: extension local storage plus iframe localStorage, including an uploaded verified board. Survives app refresh, session loss and Render restart. Download/restore JSON backup. This is **not** an authenticated multi-device database; clearing browser storage removes it. No global server cache of private leagues.

## First setup

1. Download `browser-extension.zip`, unpack, enable developer mode at `chrome://extensions`, and load the unpacked folder. Update/reload an older extension installation.
2. In the extension enter your Yahoo team URL. For mock rooms also enter the room URL; only its numeric room ID is retained, never auth query strings.
3. Open one Yahoo draft tab and the deployed Helper in the **same Chrome/Edge profile**. Reload both tabs and connect. Show Results → Round by Round in that same draft tab to collect picks. Do not open a second draft client. Keep the device awake; browser background throttling/disconnection can pause recommendations.
4. View the Yahoo player/stat table (and paginate/scroll for coverage) or upload a verified current-season board. In the normal Players screen choose **Remaining Games (proj)** for current-season totals with FGM/FGA/FTM/FTA; those volumes were verified on 25 actual displayed rows. Extension 0.2.2 retains this source when a live table later supplies percentages only. Live-only projections support seven categories. Browser-visible subsets are explicitly labeled as the evaluation population; a complete NBA player universe is not assumed. Missing/zero-GP rows cannot normalize and are disclosed/excluded, never filled. Past-season browser statistics are blocked, not relabeled as current forecasts.
5. Confirm `Helper 수신 확인 버전` in the extension and the matching receipt in the app. Run a mock draft and verify a real pick, undo, own roster, refresh recovery and stale pause before relying on this on draft day.

No repeated manual draft/roster entry is required after setup. Full hands-off behavior remains conditional on actual Yahoo room/Chrome integration validation.

## Verified file contract

CSV UTF-8 or XLSX (`DraftBoard` sheet preferred). Existing required columns remain:
`PLAYER, ADP_RANK, PTS, REB, AST, STL, BLK, 3PM, FG%, FT%, TO`.

For automatic recommendations also provide `YAHOO_ID` and `STAT_BASIS` (`per_game` or `season_total`). Add `GP` for season totals; `FGM,FGA,FTM,FTA` for weighted efficiency. `ADP_AVG` is preferred when present. A file's `ADP_RANK` may be used only when it is the verified ADP source; browser-generated display order never replaces missing Yahoo Avg Pick. Percentages in files may be fractions or 0–100 percentages. Invalid rows are rejected, not silently dropped. No external statistics or simulated projections are bundled as production data.

## Run and test

```sh
python -m pip install -r requirements-dev.txt
python -m pytest tests -q
node tests/test_extension.cjs
python package_extension.py
streamlit run app.py
```

Python tests cover formulas, IDs, data validation, snake boundaries, punts, recommendations, freshness and Streamlit UI. JS tests execute production reducer, transport and worker with a **mock Chrome API**. All arithmetic fixtures are explicitly synthetic, not usable NBA projections.

For DOM/browser integration serve this directory (`python -m http.server 8766`), then open:

- `/tests/parser-fixture.html`: automatic DOM parser assertions including auth-query stripping and live snake clock.
- `/tests/bridge-fixture.html`: production transport/iframe with simulated Chrome storage. Send synthetic capture → verify app receipt/ACK → reload iframe with transport source removed → confirm cached recovery → switch league → confirm isolation. Uses localhost fixture storage only.

These tests do not substitute for actual installed-extension → Yahoo → hosted Render testing.

## Deployment and validation boundary

Existing deployment: https://nba-draft-helper.onrender.com/ . No new paid service is required for browser persistence. Keep existing Render service settings; repository `render.yaml` is not reapplied automatically.


Never commit Yahoo auth links, credentials, private league snapshots or browser backups. The public repository contains code and clearly synthetic test fixtures only.

## 0.2.2: Yahoo single-client correction

Actual user testing showed Yahoo disconnects an existing draft client when the extension opens a duplicate. The observer-tab design failed and has been removed. The worker never duplicates, opens, activates or closes a draft tab, including when old auto_monitor settings remain. Close redundant draft tabs yourself and reload the one remaining draft after updating/reloading the extension.

Capture is now passive in one draft client: Players supplies statistics/ADP; Results → Round by Round supplies picks when visible. No automatic tab navigation or drafting actions occur. A duplicate-client logout is detected and invalidates freshness while retaining saved picks. Result visibility gaps pause recommendations after 45 seconds.

IMPORTANT: This is a safe interim correction, not completion of the original hands-off goal. Continuous full-history capture while the user stays on Players remains unresolved. The user screenshot confirms extension-to-hosted-Helper ACK revision 10, but that alone does not validate real pick/recommendation synchronization. Actual post-update single-client draft testing is still required.

