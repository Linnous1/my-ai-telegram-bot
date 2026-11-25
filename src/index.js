export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('OK', { status: 200 });

    try {
      const update = await request.json();
      
      // Log တွေမှာ ဘာတွေ ဖြစ်နေလဲ ကြည့်ဖို့ ရေးထားတာပါ
      console.log("--- New Message Received ---");
      
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || "";
        
        console.log("Chat ID: " + chatId);
        console.log("Message: " + text);
        console.log("Token ရှိလား: " + (env.TELEGRAM_BOT_TOKEN ? "ရှိတယ်" : "မရှိဘူး"));
        console.log("AI ရှိလား: " + (env.AI ? "ရှိတယ်" : "မရှိဘူး"));

        if (text === '/start') {
          console.log("စာပြန်ပို့ဖို့ ကြိုးစားနေပါတယ်...");
          let url = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: "Hello! ကျွန်တော် အလုပ်လုပ်နေပါတယ်။" })
          });
          
          const resData = await response.json();
          console.log("Telegram ဆီက ပြန်လာတဲ့ အဖြေ: " + JSON.stringify(resData));
        }
      }
    } catch (e) {
      console.error("Error တက်သွားတယ်: ", e);
    }
    return new Response('OK', { status: 200 });
  }
};
