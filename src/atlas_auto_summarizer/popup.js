document.getElementById("save").addEventListener("click", async () => {
  const webhook = document.getElementById("webhook").value;
  await chrome.storage.sync.set({ webhook });
  document.getElementById("status").innerText = "✅ Webhook saved!";
});

document.getElementById("run").addEventListener("click", async () => {
  document.getElementById("status").innerText = "⏳ Sending to GPT Atlas...";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 8000)
  }).then(async (res) => {
    const pageText = res[0].result;
    chrome.runtime.sendMessage({ type: "START_SUMMARY", pageText });
    document.getElementById("status").innerText = "🤔 Summarizing...";
  });
});
