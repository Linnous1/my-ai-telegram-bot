export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('OK', { status: 200 });

    try {
      const update = await request.json();
      if (update.message) {
        const chatId = update.message.chat.id;
        
        // Token ကို env ကနေပဲ ယူပါ
        let url = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
        
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: "စမ်းသပ်မှု အောင်မြင်ပါတယ်! သင်ပို့တာ: " + update.message.text })
        });
      }
    } catch (e) {
      console.error(e);
    }
    return new Response('OK', { status: 200 });
  }
};
