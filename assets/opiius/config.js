/* OPIIUS site settings. Edit these, not the page code.

   whatsapp    number that receives every inquiry and "get matched" request, country code first, digits only.
   callmebotKey  key from CallMeBot (free). When set, every booking request is sent straight to the "whatsapp"
               number above as a WhatsApp message, and nowhere else; the customer's WhatsApp never opens.
               It only lets messages be sent to that one number.
   bookingLog  URL of the OPIIUS booking-log Google Apps Script (see DASHBOARD-SETUP.md). Used only while
               callmebotKey is empty.
   live, goatcounter: left over from the old single-page site; not used. Visit counts come from the GoatCounter
               script (opiiusonline.goatcounter.com) added to every page by tools/build-site.mjs. */
window.OPIIUS_CONFIG = {
  live: true,
  whatsapp: "918638830682",
  phoneDisplay: "86388 30682",
  callmebotKey: "",
  bookingLog: "https://script.google.com/macros/s/AKfycbwf39vAUguEfWdsziGK_A_90BA-CuVjQZEXtNwu-5iTXTQrgCde2qGw9qqfMKLMRefe/exec",
  goatcounter: ""
};
