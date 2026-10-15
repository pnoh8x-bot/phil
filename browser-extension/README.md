# Yahoo browser bridge 0.2.0

Load this folder unpacked in Chrome/Edge developer mode. Only `storage` permission and content scripts on Yahoo basketball/Helper component pages are used. No cookies, credentials, Yahoo API, hidden endpoints or automated player selections.

Enter your team URL in the popup. A mock room needs its room URL too; the auth query is discarded. Reload Yahoo and Helper after installing/updating. Leave the automatically duplicated Results observer tab open. The original tab remains available for player stats and drafting. Confirm the Helper receipt revision in both app and popup.

Stats and ADP are read only when displayed. Unknown units pause evaluation; missing FG/FT volume disables those categories. Incomplete results pause recommendations. Records survive refresh in extension storage, and Helper caches the last connected state and verified file in same-origin browser localStorage. Back up before clearing browser data.

Actual simultaneous Yahoo draft-tab compatibility and real installed-extension delivery to Render still require a Chrome mock-draft test. Local mocks/DOM fixtures passing do not prove that integration.
