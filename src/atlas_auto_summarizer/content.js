chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "summarizePage") {
    const pageText = document.body.innerText.slice(0, 8000);
    chrome.runtime.sendMessage({ type: "START_SUMMARY", pageText });
  }
});
