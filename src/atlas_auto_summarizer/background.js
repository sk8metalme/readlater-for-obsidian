chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "START_SUMMARY") {
    // Atlasタブを探す
    const tabs = await chrome.tabs.query({
      url: ["https://chat.openai.com/*", "https://chatgpt.com/*"]
    });

    if (tabs.length === 0) {
      chrome.notifications.create({
        type: "basic",
        title: "Atlas not found",
        message: "GPT Atlasを開いてから実行してください。",
        iconUrl: "icons/icon128.png"
      });
      return;
    }

    const atlasTab = tabs[0];
    const prompt = `次のWebページの内容を日本語で200文字以内に要約してください:\n\n${msg.pageText}`;

    // Atlasにプロンプトを送信
    chrome.scripting.executeScript({
      target: { tabId: atlasTab.id },
      func: (prompt) => {
        const textarea = document.querySelector("textarea");
        if (!textarea) return alert("ChatGPT入力欄が見つかりません。");
        textarea.value = prompt;
        textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
        const btn = document.querySelector('button[data-testid="send-button"]');
        btn?.click();
      },
      args: [prompt]
    });

    sendResponse({ ok: true });
  }

  if (msg.type === "POST_TO_SLACK") {
    const { text } = msg;
    const { webhook } = await chrome.storage.sync.get("webhook");
    if (!webhook) return console.warn("⚠️ Slack Webhook未設定");

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `📰 *GPT Atlas 要約:*\n${text}` })
    });
    console.log("✅ Slackに投稿完了");
  }

  return true;
});
