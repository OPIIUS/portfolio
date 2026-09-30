# Adding a partner agency to OPIIUS

1. At the agency, open **opiius.online/onboard.html** on your phone and fill it in with the owner
   (takes about 10 minutes). The draft is kept on your phone if you close the page.
2. Take 2 or 3 clear daylight photos of each vehicle (whole car in frame, number plate optional).
3. Tap **Create the block**, then **Copy block**.
4. Paste the block into the chat with Claude and attach the photos, in the same order as the vehicles.
5. Claude adds the entry to `assets/opiius/partners.js`, puts the photos in `assets/partners/<agency-id>/`,
   checks the pages and publishes. The agency is live on opiius.online a minute later.

Rules
- Only list an agency whose owner has agreed (the form will not create a block without it).
- "Verified" is shown only when you have seen their self-drive permit and commercial insurance.
- Prices and terms must be exactly what the owner told you; customers see them before booking.
- Owner phone numbers are never put on the site. Reservations come to the OPIIUS WhatsApp number
  (assets/opiius/config.js) and you forward them.

To change prices or remove an agency later, just tell Claude ("Change X's Swift to ₹1,900" / "Remove X").
