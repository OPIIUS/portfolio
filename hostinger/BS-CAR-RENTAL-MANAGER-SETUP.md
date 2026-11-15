# BS Car Rentals: management system setup

Upload **`bs-car-rental-manager.zip`**. It opens at **https://bscarrental.co.in/manage**. The public website is not touched.

## Already filled in from bscarrental.co.in

| What | Value |
|---|---|
| Business name | BS Car Rentals |
| Phone | 91015 83341 |
| Address | Chagalpara, near Manasha Mandir Path, VIP Road, Lokhra, Guwahati, Assam 781040 |
| Currency | INR (₹) |
| Rent charged | Per day |
| Rental numbers | BS26-0001, BS26-0002, … |
| Categories | Hatchback, Sedan, Compact SUV, SUV, 7-seater, Scooty |
| Late return | ₹300 per hour (suggested at return; only charged if you tick it) |
| Extra km | ₹10 per km. Free km: 280/day for hatchbacks and sedans, 300/day for SUVs and 7-seaters |
| Usual rental rules | Filled into every new rental: km per day, extra km, late fee, 12-hour extension notice, ID kept as security, fuel/FASTag/fines, damage up to ₹50,000 |
| **25 vehicles** | All 22 cars and 3 scooters from the website, each with its photo, daily price, seats, fuel, gearbox, free km and engine details |

**The 25 vehicles and their daily prices:**

- **Hatchback:** Alto K10 ₹1,500 · Swift ₹1,800 · Grand i10 Nios ₹1,800 · i20 ₹2,000
- **Sedan:** Swift Dzire ₹2,000 · Verna ₹2,500
- **Compact SUV:**
  - Punch ₹2,000 · Fronx ₹2,200
  - Nexon ₹2,500 · Brezza ₹2,500 · Venue ₹2,500
  - Kia Sonet ₹2,500 (website price not yet confirmed)
  - XUV300 Automatic ₹2,500
- **SUV:**
  - Seltos ₹2,700 · Creta ₹2,700
  - Thar 3-door ₹3,500
  - Scorpio N ₹4,000 · XUV700 ₹4,000 · Thar Roxx ₹4,000
- **7-seater:** Ertiga ₹3,000 · Carens ₹3,000 · Innova Crysta ₹4,000
- **Scooty:** Aerox 155 ₹800 · Ntorq 125 ₹700 · Activa 6G ₹600

## Not on the website, so the owner fills these in

1. **Registration number and current kilometre reading of each vehicle.** They start as TEMP 01 … TEMP 25 with 0 km. The Cars page and the Dashboard list which ones still need them. Open each car → **Edit**.
2. **Insurance and PUC expiry dates.** Go to **Maintenance & Documents** → "Enter the expiry date" on each reminder.
3. **Monthly prices**, if you offer them (Edit car).
4. **Owner name, email and password**, entered on the setup screen.
5. **Opening date** (optional), on the setup screen or in Settings → Business.

## Steps (about 15 minutes)

1. **Database:**
   1. hPanel → bscarrental.co.in → **Databases → Management**.
   2. Create a database and user, and copy the password.
   3. Note the full names (they start with `u…_`).
2. **Upload:**
   1. **File Manager → public_html** → create the folder **`manage`** → upload `bs-car-rental-manager.zip` → **Extract** with folder name `.`.
   2. You should see `index.php`, `install.php`, `assets`, `lib`, `pages`, `presets`, `storage`, `tests` inside `manage`. If they landed in a sub-folder, move them up into `manage`.
   3. Delete the zip.
3. **Setup:**
   1. Open **https://bscarrental.co.in/manage/install.php**.
   2. "Start from" already shows **BS Car Rentals**, and the business details are filled in.
   3. Choose **MySQL**, enter the database details, keep **"Add BS Car Rentals' 25 vehicles"** ticked, then enter the owner's name, email and password.
   4. Click **Set up**, then delete `install.php`.
4. **Hourly reminders:**
   1. In the app, open **Settings → Automatic checks** and copy the `php …/cron.php` line.
   2. In hPanel, open **Advanced → Cron Jobs → Custom**, paste it and choose **Every hour**.
5. **Sign in** at **https://bscarrental.co.in/manage** and fill in the registration numbers and km readings (Cars page).

Daily use and troubleshooting are the same as in `CAR-RENTAL-MANAGER-SETUP.md`.
