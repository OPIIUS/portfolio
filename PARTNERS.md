# Adding a partner to OPIIUS

When an agency or tour operator agrees to join, collect the details below and send them to Claude
(paste the text, attach the photos). Claude adds them to `assets/opiius/data.js` and puts the photos in
`assets/partners/<agency-id>/`. Only partners marked `real: true` appear on the live site.

## Rental agency
- Agency name, and the area in the city (e.g. "Six Mile, GS Road")
- City: Guwahati, Shillong, Kaziranga, Sohra, Dawki or Tawang
- Pickup points (and airport or railway delivery, with the charge if any)
- Since which year they have been renting
- Terms: security deposit, km limit per day, fuel policy, cancellation policy, documents needed
- Has a valid self-drive rental permit and commercial insurance? (needed for the Verified badge)
- For every vehicle:
  - Make and model (e.g. Maruti Ertiga), year, manual or automatic, fuel, seats
  - Price per day, and how many of that vehicle they have
  - 2 or 3 clear photos of their own vehicle (daylight, whole car in frame)
- A short line about the agency (what they are good at)

## Tour operator
- Name, base city, since which year, registration details
- For every package: title, days and nights, price per person, places covered, day-by-day plan,
  what is included and not included, trip style (family, honeymoon, adventure...)
- 2 or 3 photos per package

## Where reservations go
Reservations and requests open WhatsApp to the number in `assets/opiius/config.js`. You forward each one to
the agency, so every lead is counted before you ask anyone to pay.
