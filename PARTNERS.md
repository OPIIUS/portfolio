# Adding a partner agency or tour operator to OPIIUS

- Rental agencies: **opiius.online/onboard.html**
- Tour operators: **opiius.online/onboard-tours.html** (packages, route in visiting order, day-by-day plan, inclusions; 1–2 photos per package)

Both work the same way:

1. Send the owner the right link (or fill it in with them). The draft is kept on their phone if they close the page.
2. They tap **Create the block**, then **Send to OPIIUS on WhatsApp**: it opens a chat to 86388 30682
   with all their details filled in. They send it and attach 2–3 daylight photos per vehicle / 1–2 per package.
3. Forward that WhatsApp message and the photos to Claude.
4. Claude adds the entry to `assets/opiius/partners.js`, puts the photos in `assets/partners/<id>/`,
   checks the pages and publishes. They are live on opiius.online a minute later.

Rules
- Only list an agency whose owner has agreed (the form will not create a block without it).
- "Verified" is shown only when you (OPIIUS) have seen their permit and insurance / registration yourself. Owners can now fill the forms themselves and tick those boxes; Claude treats a self-filled tick as "to check" and asks you before adding the badge.
- Prices and terms must be exactly what the owner told you; customers see them before booking.
- Owner phone numbers are never put on the site. Reservations come to the OPIIUS WhatsApp number
  (assets/opiius/config.js) and you forward them.

To change prices or remove an agency later, just tell Claude ("Change X's Swift to ₹1,900" / "Remove X").
