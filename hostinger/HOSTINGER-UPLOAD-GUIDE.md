# BS Car Rentals: putting the website live on Hostinger

**Domain: `bscarrental.co.in`**. The website files are already set up for this exact domain: Google listing, share preview and sitemap.

You need two things:

1. **`bs-car-rentals-website.zip`**: the complete website, already tested and ready to upload.
2. **This guide.**

You need no coding and no extra tools. The whole job takes about 20 minutes, plus up to a few hours for the domain to start working.

**What is inside the ZIP**

| File | What it is |
|---|---|
| `index.html` | The website itself (all pages, design, booking and enquiry forms) |
| `cars/` | All 21 car photos, plus smaller copies in `cars/sm/` for phones |
| `img/` | The small OPIIUS logo used in the footer |
| `favicon.svg` | The little "BS" icon shown in the browser tab |
| `.htaccess` | Hostinger settings that make the site load faster. This file is hidden; don't delete it. |
| `robots.txt`, `sitemap.xml` | Let Google find and list the website at bscarrental.co.in |

Bookings and enquiries go straight to WhatsApp on **91015 83341**. There is no database, email setup or form service to configure.

---

## Step 0: The domain is active ✅

**bscarrental.co.in** was registered on 14 Nov 2026 with Hostinger's nameservers, and the website is live at **https://bscarrental.co.in** with the padlock.

Always type it with **two "r"s**: **bs-car-rental**.co.in. If you type `bscarental.co.in` with one "r", you get "site cannot be reached", because that address doesn't exist.

## Step 1: Get the domain

**A. You are buying the domain on Hostinger (easiest)**
1. Log in at **hpanel.hostinger.com**.
2. Go to **Domains → Get a new domain**.
3. Search for the name, e.g. `bscarrentals.in` or `bscarrentalsguwahati.com`, then buy it.
4. Skip to Step 2. There are no DNS settings to change.

**B. The domain was bought somewhere else (GoDaddy, BigRock, Namecheap…)**
1. Log in to the site where bscarrental.co.in was bought.
2. Find **Nameservers** for that domain and choose **Custom nameservers**.
3. Replace what is there with these two:
   - `ns1.dns-parking.com`
   - `ns2.dns-parking.com`
4. Save. It can take from 1 hour up to 24 hours to start working.

---

## Step 2: Add the website in Hostinger

1. In **hPanel**, click **Websites** in the left menu, then **+ Add website**.
2. When it asks what kind of website, choose **Custom PHP/HTML website**. Hostinger sometimes calls this "Empty website" or "Skip, I want to upload my own".

   ⚠️ **Don't** choose WordPress or the Website Builder.
3. Pick **bscarrental.co.in** from the list. If you bought it elsewhere, type it in.
4. Finish the setup and wait until it says the website was created.

---

## Step 3: Upload the website

1. In hPanel go to **Websites**, then **Dashboard** for your domain, then **File Manager**.
2. Open the folder **`public_html`**. This is the only folder the public can see.
3. If there is a file called **`default.php`** or **`index.php`** in there, delete it. It is Hostinger's placeholder page.
4. Click the **Upload** button (an arrow pointing up) and upload **`bs-car-rentals-website.zip`**.
5. Right-click the uploaded ZIP, choose **Extract**, and extract it **into `public_html` itself**. Leave the folder name blank or type `.`.
6. Check that `public_html` now directly contains `index.html`, `cars`, `img`, `favicon.svg`, `robots.txt` and `.htaccess`.

   If they ended up inside a sub-folder instead, open that sub-folder, select everything, choose **Move**, and move it to `public_html`.
7. Delete the ZIP file from `public_html`. It isn't needed any more.

> **Can't see `.htaccess`?** It is a hidden file. In File Manager, open **Settings → Show hidden files**. If it is missing, the site still works; it will just load a little slower.

---

## Step 4: Turn on the padlock (free SSL)

1. In hPanel go to **Security → SSL**. You may find it under **Websites → Dashboard → Security**.
2. Find your domain and click **Install SSL**, using the free Lifetime SSL. On most plans it installs automatically within a few minutes.
3. When it shows **Active**, switch on **Force HTTPS**. You'll find it on the same SSL page or under **Advanced → Force HTTPS**.

   Without SSL, browsers show a "Not secure" warning.

> If you use domain option B, SSL can only install **after** the nameservers from Step 1 start working. If it says "domain not pointing", wait a few hours and try again.

---

## Step 5: Check that everything works

Open **https://bscarrental.co.in** on **a phone and a computer** and tick these off:

- [ ] The red-and-black page opens with the car slideshow.
- [ ] The padlock 🔒 shows next to the address.
- [ ] Every car shows its photo.
- [ ] Tapping a car opens the details panel with specs and the enquiry form.
- [ ] Filling the form and tapping **Send enquiry on WhatsApp** opens WhatsApp with the booking message to **91015 83341**.
- [ ] The map shows Lokhra, and **Get directions** opens Google Maps.
- [ ] The call and WhatsApp buttons work.

If you still see an old page, clear the cache: in hPanel go to **Advanced → Cache Manager → Purge all**. Then refresh, or close the tab and open it again.

---

## Step 6: Get customers to the website (after it is live)

1. **Google Business Profile:** add the website link. This matters most, because people searching "car rental Lokhra" will see it.
2. **Instagram bio, WhatsApp Business profile and Facebook page:** add the website link to each.
3. **Optional, to appear on Google faster:**
   1. Go to **search.google.com/search-console** → **Add property → Domain** and enter `bscarrental.co.in`.
   2. Google gives you a **TXT record**. In hPanel go to **Domains → DNS / Nameservers → Add record**, choose type **TXT**, and paste the record.
   3. Back in Search Console, click **Verify**.
   4. Go to **Sitemaps**, enter `sitemap.xml` and click **Submit**.
   5. Then use **URL inspection → Request indexing**.

---

## Fixing common problems

| What you see | What to do |
|---|---|
| Hostinger's own page, or "Index of /" | `index.html` is not directly inside `public_html`. Move the files up (Step 3, point 6). Delete `default.php`. |
| "403 Forbidden" | Same fix as above. |
| "This site can't be reached" | The domain isn't pointing to Hostinger yet. For option B, check the nameservers and wait up to 24 hours. |
| "Not secure" | SSL is not active yet. Do Step 4 again, or wait. |
| Some photos missing | The `cars` folder didn't upload fully. Upload and extract the ZIP again. |
| Old version still showing | Purge the cache (Step 5), then refresh. |

---

## Changing prices or cars later (no coding needed)

1. Go to **File Manager → public_html**. Right-click **`index.html`** and choose **Edit**.
2. Press **Ctrl+F** and search for the car's name in quotes, e.g. `"Creta"`.
3. You will find a line like this:

   ```
   {n:"Creta",img:"creta",c:"suv",p:2700,s:5},
   ```

   - `p:2700` is the **price per day**. Change only the number, e.g. `p:2900`.
   - `s:5` is the number of **seats**.
4. Click **Save**, then purge the cache (Step 5).

Rules:
- Only change the numbers.
- Keep every comma, quote mark and bracket exactly as it is.
- If something breaks, upload the ZIP again and it goes back to how it was delivered.

**To change a car photo:**
1. Upload the new photo into `cars/`, with the **same file name** as the old one (e.g. `creta.jpg`). Landscape works best.
2. Also put a copy in `cars/sm/` with the same name.

**The phone number** appears in several places. Search for `9101583341` and replace every match.

---

## Good to know

- **The map** shows the exact Google pin for "BS Self Drive Car & Bike Rental Services Guwahati" (Chagalpara, near Manasha Mandir Path, VIP Road, Lokhra). The **Get directions** buttons open the owner's own Google Maps link.
- **Car specs** (mileage, top speed, engine…) are typical figures for each model. The site says they may differ by variant. To edit them, search for `var SPEC=` in `index.html`.
- **A backup** of this exact website is also saved in the OPIIUS GitHub account under `hostinger/bs-car-rentals-site`.
- **Monthly cost:** the Hostinger plan plus the yearly domain renewal. Turn on **auto-renew** for both, so the site never goes offline.
