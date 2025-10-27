// popup.js with Slack webhook validation and error handling

document.getElementById("save").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const webhookInput = document.getElementById("webhook");
  const webhook = webhookInput.value.trim();

  // Validate Slack webhook URL
  if (!webhook) {
    status.innerText = "\u26A0\uFE0F Webhook URL\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044";
    return;
  }
  if (!webhook.startsWith("https://hooks.slack.com/")) {
    status.innerText = "\u26A0\uFE0F Webhook URL\u304C\u7121\u52B9\u3067\u3059";
    return;
  }
  try {
    new URL(webhook);
  } catch (e) {
    status.innerText = "\u26A0\uFE0F Webhook URL\u304C\u4E0D\u6B63\u3067\u3059";
    return;
  }

  try {
    await chrome.storage.sync.set({ webhook });
    status.innerText = "\u2705 Webhook saved!";
  } catch (err) {
    console.error("Error saving webhook:", err);
    status.innerText = "\u26A0\uFE0F Webhook\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F";
  }
});

document.getElementById("run").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.innerText = "\u23F3 \u8981\u7D04\u3092\u958B\u59CB\u3057\u307E\u3059...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      status.innerText = "\u26A0\uFE0F \u30BF\u30D6\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093";
      return;
    }
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 8000),
    });
    const pageText = result && result[0] && result[0].result ? result[0].result : "";
    // Send message to background to start summarization
    chrome.runtime.sendMessage({ type: "START_SUMMARY", pageText });
    status.innerText = "\uD83E\uDD14 \u8981\u7D04\u4E2D...";
  } catch (err) {
    console.error("Error during summarization:", err);
    status.innerText = "\u26A0\uFE0F \u8981\u7D04\u306B\u5931\u6557\u3057\u307E\u3057\u305F";
  }
});
