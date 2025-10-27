let shouldWatch = false; // Flag to ensure only one Slack post per summary
let watchTimeout; // Timer to automatically stop watching after a period
window.__postedToSlack = window.__postedToSlack || false;

// Listen for messages from the background script to control watching behavior
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RESET_SLACK_FLAG') {
    window.__postedToSlack = false;
    return;
  }
  if (msg.type === 'START_WATCH') {
    shouldWatch = true;
    // Reset posted flag when starting a new watch
    window.__postedToSlack = false;
    // Clear any existing timeout and set a new one to stop watching after 30 seconds
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      shouldWatch = false;
    }, 30000);
    return;
  }
});

// MutationObserver to detect new ChatGPT assistant messages
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
