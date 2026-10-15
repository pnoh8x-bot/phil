NBATransport.bind({get:k=>chrome.storage.local.get(k),set:v=>chrome.storage.local.set(v),onChanged:chrome.storage.onChanged},window);
