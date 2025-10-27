let shouldWatch = false;
// Flag to ensure only one Slack post per summary
window.__postedToSlack = window.__postedToSlack || false;

// Listen for messages from the background script to control watching behavior
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RESET_SLACK_FLAG') {
    window.__postedToSlack = false;
    return;
  }
  if (msg.type === 'START_WATCH') {
    shouldWatch = true;
    return;
  }
});

const observer = new MutationObserver(() => {
  if (!shouldWatch) return;
  const messages = document.querySelectorAll("div[data-message-author-role='assistant']");
  if (messages.length === 0) return;
  const last = messages[messages.length - 1];
  const text = last.innerText.trim();
  if (!text) return;
  // Only send to Slack if text is sufficiently long and not yet posted
  if (text.length > 50 && !window.__postedToSlack) {
    window.__postedToSlack = true;
    shouldWatch = false;
    chrome.runtime.sendMessage({ type: 'POST_TO_SLACK', text });
  }
});

observer.observe(document.body, { childList: true, subtree: true });
