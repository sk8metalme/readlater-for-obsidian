const observer = new MutationObserver(() => {
  const messages = document.querySelectorAll("div[data-message-author-role='assistant']");
  if (messages.length === 0) return;
  const last = messages[messages.length - 1];
  const text = last.innerText.trim();
  if (!text) return;
  if (text.length > 50 && !window.__postedToSlack) {
    window.__postedToSlack = true;
    chrome.runtime.sendMessage({ type: 'POST_TO_SLACK', text });
  }
});
observer.observe(document.body, { childList: true, subtree: true });
