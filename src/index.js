import { PDFDocument } from 'pdf-lib';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('OK', { status: 200 });

    try {
      const update = await request.json();

      if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        if (cb.data === 'lang_my' || cb.data === 'lang_en') {
          let settingsKey = "settings_" + chatId;
          let settingsRaw = await env.CHAT_HISTORY.get(settingsKey);
          let settings = settingsRaw ? JSON.parse(settingsRaw) : {};
          settings.lang = cb.data === 'lang_my' ? 'my' : 'en';
          await env.CHAT_HISTORY.put(settingsKey, JSON.stringify(settings));
          
          let apiUrl = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/answerCallbackQuery";
          await fetch(apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: settings.lang === 'my' ? 'မြန်မာဘာသာ ရွေးချယ်ပြီးပါပြီ။' : 'English selected.' })
          });
          
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, settings.lang === 'my' ? '✅ မြန်မာဘာသာစကားကို ရွေးချယ်ပြီးပါပြီ။' : '✅ English language selected.');
        }
        return new Response('OK');
      }

      if (!update.message) return new Response('OK', { status: 200 });

      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || "";
      const lowerText = text.toLowerCase();

      let settingsKey = "settings_" + chatId;
      let settingsRaw = await env.CHAT_HISTORY.get(settingsKey);
      let settings = settingsRaw ? JSON.parse(settingsRaw) : { lang: 'my', role: 'helpful AI assistant' };
      const isMyanmar = settings.lang === 'my' || text.match(/[\u1000-\u109F]/);

      if (text === '/start') {
        const keyboard = {
          keyboard: [
            [{ text: "💬 New chat" }, { text: "🖼️ Photo Styles" }],
            [{ text: "📄 PDF ထုတ်ရန်" }, { text: "⚡ Quick actions" }],
            [{ text: "📁 Chat history" }, { text: "🌐 Language / ဘာသာစကား" }]
          ],
          resize_keyboard: true, is_persistent: true
        };
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "မင်္ဂလာပါ! အောက်က ခလုတ်တွေကို နှိပ်ပြီး အသုံးပြုနိုင်ပါတယ်။", keyboard);
        return new Response('OK');
      }

      if (text === "🌐 Language / ဘာသာစကား" || text === '/lng') {
        const inlineKeyboard = { inline_keyboard: [[{ text: "🇲🇲 မြန်မာ", callback_data: "lang_my" }, { text: "🇬🇧 English", callback_data: "lang_en" }]] };
        let apiUrl = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
        await fetch(apiUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: "ဘာသာစကား ရွေးချယ်ပါ / Please select language:", reply_markup: inlineKeyboard })
        });
        return new Response('OK');
      }

      if (text === "💬 New chat" || text === '/new') {
        await env.CHAT_HISTORY.delete(chatId.toString());
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "မှတ်ဉာဏ်အသစ် စတင်ပါပြီ။");
        return new Response('OK');
      }

      if (text === "🖼️ Photo Styles") {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "ပုံထုတ်ချင်တဲ့ အကြောင်းအရာကို ရိုက်ပါ (ဥပမာ - /img cute cat)");
        return new Response('OK');
      }

      if (text === "📄 PDF ထုတ်ရန်") {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "PDF ခေါင်းစဉ်ကို ရိုက်ပါ (ဥပမာ - /pdf မြန်မာ့သမိုင်း)");
        return new Response('OK');
      }

      if (text === "⚡ Quick actions" || text === '/help') {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📖 အသုံးပြုနည်း\n• /img [စာသား] - ပုံထုတ်ရန်\n• /pdf [ခေါင်းစဉ်] - PDF ထုတ်ရန်");
        return new Response('OK');
      }
      if (text === "📁 Chat history") {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "မှတ်တမ်းများကို စစ်ဆေးနေပါသည်။");
        return new Response('OK');
      }

      if (lowerText.startsWith('/img')  lowerText.includes('ပုံထုတ်')  lowerText.includes('image')) {
        let prompt = text.replace(/\/img|ပုံထုတ်ပေး|ပုံထုတ်|ပုံဆွဲ|image|picture|draw/gi, '').trim();
        if (!prompt) prompt = "a beautiful landscape"; 
        const imageResponse = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt: prompt });
        const binaryString = atob(imageResponse.image);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
        const imageBlob = new Blob([bytes], { type: 'image/jpeg' });
        await sendPhoto(env.TELEGRAM_BOT_TOKEN, chatId, imageBlob, "ဒီမှာ သင့်ပုံပါ: " + prompt);
        return new Response('OK');
      }

      if (lowerText.startsWith('/pdf') || lowerText.includes('pdf')) {
        let topic = text.replace(/\/pdf|pdf|ဖိုင်|ထုတ်ပေး|ထုတ်|file|အတွက်/gi, '').trim();
        if (!topic) topic = "အထွေထွေအချက်အလက်";
        let aiPrompt = "Write a summary about: " + topic + " in Burmese.";
        
        // 🌟 စာသားမော်ဒယ်အသစ်
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [{ role: 'user', content: aiPrompt }]
        });
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); 
        const fontUrl = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Regular.ttf';
        const fontBytes = await (await fetch(fontUrl)).arrayBuffer();
        const customFont = await pdfDoc.embedFont(fontBytes);
        
        function wrapText(text, maxWidth, fontSize, font) {
          const words = text.split(' '); const lines = []; let currentLine = '';
          for (const word of words) {
            const testLine = currentLine ? currentLine + " " + word : word;
            if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) { lines.push(currentLine); currentLine = word; } else { currentLine = testLine; }
          }
          if (currentLine) lines.push(currentLine); return lines;
        }
        
        let y = 800;
        for (const p of aiResponse.response.split('\n')) {
          if (y < 50) break; 
          for (const line of wrapText(p, 500, 12, customFont)) {
            if (y < 50) break; 
            page.drawText(line, { x: 50, y: y, size: 12, font: customFont }); 
            y -= 20; 
          }
          y -= 10; 
        }
        
        const pdfBlob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });
        await sendDocument(env.TELEGRAM_BOT_TOKEN, chatId, pdfBlob, 'document.pdf', "ဒီမှာ " + topic + " PDF ပါ။");
        return new Response('OK');
      }

      if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        let getFileUrl = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/getFile?file_id=" + photo.file_id;
        const fileRes = await fetch(getFileUrl);
        const fileData = await fileRes.json();
        let fileUrl = "https://api.telegram.org/file/bot" + env.TELEGRAM_BOT_TOKEN + "/" + fileData.result.file_path;
        const imageBuffer = await (await fetch(fileUrl)).arrayBuffer();
        
        let visionPrompt = text || "Describe this image.";
        
        // 🌟 ပုံဖတ်မော်ဒယ်
        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          image: [...new Uint8Array(imageBuffer)], prompt: visionPrompt,
        });
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, aiResponse.response);
        return new Response('OK');
      }
      let history = await env.CHAT_HISTORY.get(chatId.toString());
      history = history ? JSON.parse(history) : [];
      let sysPrompt = "You are a " + settings.role + ". Reply in " + (isMyanmar ? 'Burmese' : 'English') + ".";
      const systemMsg = { role: "system", content: sysPrompt };
      
      if (history.length > 0 && history[0].role === 'system') { history[0] = systemMsg; } else { history.unshift(systemMsg); }
      history.push({ role: "user", content: text });
      if (history.length > 12) history = history.slice(-12);
      
      // 🌟 စကားပြောမော်ဒယ်အသစ်
      const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: history });
      history.push({ role: "assistant", content: aiResponse.response });
      await env.CHAT_HISTORY.put(chatId.toString(), JSON.stringify(history));
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, aiResponse.response);

    } catch (error) { console.error(error); }
    return new Response('OK', { status: 200 });
  }
};

async function sendMessage(token, chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text: text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  let url = "https://api.telegram.org/bot" + token + "/sendMessage";
  await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function sendPhoto(token, chatId, photoBlob, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId); formData.append('photo', photoBlob, 'image.jpg'); formData.append('caption', caption);
  let url = "https://api.telegram.org/bot" + token + "/sendPhoto";
  await fetch(url, { method: 'POST', body: formData });
}

async function sendDocument(token, chatId, docBlob, filename, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId); formData.append('document', docBlob, filename); formData.append('caption', caption);
  let url = "https://api.telegram.org/bot" + token + "/sendDocument";
  await fetch(url, { method: 'POST', body: formData });
}
