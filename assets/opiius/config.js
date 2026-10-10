/* OPIIUS site settings. Edit these, not the page code.

   whatsapp    number that receives every inquiry and "get matched" request, country code first, digits only.
   telegramToken, telegramChat  the OPIIUS Telegram bot's token (from @BotFather) and your chat id (from
               @userinfobot). When both are set, every booking request is sent straight to your Telegram as a message,
               and nowhere else; the customer's WhatsApp never opens. If the token is ever misused, revoke it in
               @BotFather (/revoke) and put the new one here.
   callmebotKey  alternative: a CallMeBot key, to get the same message on WhatsApp instead.
   bookingLog  URL of the OPIIUS booking-log Google Apps Script (see DASHBOARD-SETUP.md). Used only while
               no Telegram bot or CallMeBot key is set.
   live, goatcounter: left over from the old single-page site; not used. Visit counts come from the GoatCounter
               script (opiiusonline.goatcounter.com) added to every page by tools/build-site.mjs. */
window.OPIIUS_CONFIG = {
  live: true,
  whatsapp: "918638830682",
  phoneDisplay: "86388 30682",
  telegramToken: "",
  telegramChat: "",
  callmebotKey: "",
  bookingLog: "https://script.google.com/macros/s/AKfycbwf39vAUguEfWdsziGK_A_90BA-CuVjQZEXtNwu-5iTXTQrgCde2qGw9qqfMKLMRefe/exec",
  goatcounter: ""
};
