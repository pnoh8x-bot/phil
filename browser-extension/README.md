# Yahoo browser bridge 0.2.2

Load this folder unpacked in Chrome/Edge developer mode. Only `storage` permission and content scripts on Yahoo basketball/Helper component pages are used. No cookies, credentials, Yahoo API, hidden endpoints or automated player selections.


Stats and ADP are read only when displayed. Normal Players → Remaining Games (proj) supplies current-season totals with shot volumes; paginate for coverage. These verified volumes are retained when a live draft table supplies percentages only. Past-season statistics are blocked by Helper. Unknown units pause evaluation; missing FG/FT volume disables those categories. Incomplete results pause recommendations. Records survive refresh in extension storage, and Helper caches the last connected state and verified file in same-origin browser localStorage. Back up before clearing browser data.


## 0.2.2: Yahoo single-client correction

Actual user testing showed Yahoo disconnects an existing draft client when the extension opens a duplicate. The observer-tab design failed and has been removed. The worker never duplicates, opens, activates or closes a draft tab, including when old auto_monitor settings remain. Close redundant draft tabs yourself and reload the one remaining draft after updating/reloading the extension.

Capture is now passive in one draft client: Players supplies statistics/ADP; Results → Round by Round supplies picks when visible. No automatic tab navigation or drafting actions occur. A duplicate-client logout is detected and invalidates freshness while retaining saved picks. Result visibility gaps pause recommendations after 45 seconds.

IMPORTANT: This is a safe interim correction, not completion of the original hands-off goal. Continuous full-history capture while the user stays on Players remains unresolved. The user screenshot confirms extension-to-hosted-Helper ACK revision 10, but that alone does not validate real pick/recommendation synchronization. Actual post-update single-client draft testing is still required.

