chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "START_SUMMARY") {
    try {
      const tabs = await chrome.tabs.query({
        url: ["https://chat.openai.com/*", "https://chatgpt.com/*"]
      });

      if (tabs.length === 0) {
        await chrome.notifications.create({
          type: "basic",
          title: "Atlas not found",
          message: "GPT Atlasタブを開いてから実行してください。"
        });
        return;
      }

      const atlasTab = tabs[0];

      // Reset Slack flag and start watching
      chrome.tabs.sendMessage(atlasTab.id, { type: "RESET_SLACK_FLAG" });
      chrome.tabs.sendMessage(atlasTab.id, { type: "START_WATCH" });

      const prompt = `次のWebページの内容を日本語で200文字以内に要約してください:\n\n${msg.pageText}`;

      // Send the prompt to ChatGPT
      await chrome.scripting.executeScript({
        target: { tabId: atlasTab.id },
        func: (prompt) => {
          const textarea = document.querySelector("textarea");
          if (!textarea) {
            console.error("ChatGPT入力案が見つかりません。");
            return;
          }
          textarea.value = prompt;
          textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
          const btn = document.querySelector('button[data-testid="send-button"]');
          setTimeout(() => {
            if (btn) {
              btn.click();
            } else {
              console.error("Send button not found.");
            }
          }, 100);
        },
        args: [prompt]
      });

      sendResponse({ ok: true });
    } catch (err) {
      console.error('Error in START_SUMMARY:', err);
      await chrome.notifications.create({
        type: "basic",
        title: "Error",
        message: "要約実行中にエラーが発生しました。"
      });
    }
    return;
  }

  if (msg.type === "POST_TO_SLACK") {
    try {
      const { text } = msg;
      const { webhook } = await chrome.storage.sync.get("webhook");
      if (!webhook) {
        await chrome.notifications.create({
          type: "basic",
          title: "Slack webhook未設定",
          message: "Slack webhook URLが設定されていません。"
        });
        console.error('Slack webhook未設定');
        return;
      }
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ` GPT Atlas要約:\n${text}` })
      });
      if (!response.ok) {
        throw new Error(`Slack responded with status ${response.status}`);
      }
      await chrome.notifications.create({
        type: "basic",
        title: "Slackに投稿完了",
        message: "要約をSlackに投稿しました。"
      });
    } catch (err) {
      console.error('Error posting to Slack:', err);
      await chrome.notifications.create({
        type: "basic",
        title: "Slack投稿エラー",
        message: "Slackへの投稿中にエラーが発生しました。"
      });
    }
    return;
  }
});
