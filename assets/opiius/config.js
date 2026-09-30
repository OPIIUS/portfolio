/* OPIIUS site settings. Edit these, not the app code.

   live        true  = only real partner agencies/operators (real:true in data.js) are shown and
                       "Reserve" opens WhatsApp to the number below.
               false = pitch mode: sample (DEMO) listings everywhere, no WhatsApp.
               Anyone can preview pitch mode on the live site with  opiius.online/?demo=1  (and ?demo=0 to leave).
   whatsapp    number that receives reservations and trip requests, country code first, digits only.
   goatcounter your GoatCounter code (the "xxx" in https://xxx.goatcounter.com). Empty = no analytics. */
window.OPIIUS_CONFIG = {
  live: true,
  whatsapp: "918638830682",
  phoneDisplay: "86388 30682",
  goatcounter: ""
};
