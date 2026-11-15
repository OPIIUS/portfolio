# Car Rental Manager: set up on Hostinger

A simple system for running a car rental business: cars, customers, rentals, payments, returns and damage, service and document reminders, and reports. It runs on any Hostinger plan that has PHP and MySQL. Total set-up time is about 15 minutes.

The app opens at `https://YOUR-DOMAIN/manage` and only people with a login can use it.

---

## 1. Create a database (3 minutes)

1. Open **hPanel** → **Websites** → **Manage** next to the domain.
2. Go to **Databases** → **Management**.
3. Fill in a database name (e.g. `rentals`), a username (e.g. `rentals`) and a password. Press **generate** for the password and copy it somewhere safe.
4. Click **Create**.
5. Write down the full database name and username shown in the list. They start with `u123456789_`.

## 2. Upload the files (5 minutes)

1. Open **Files** → **File Manager** → **public_html**.
2. Create a folder called `manage` and open it.
3. Upload **`car-rental-manager.zip`**, right-click it → **Extract**, and type `.` as the folder name.
4. Check that you see `index.php`, `install.php`, `cron.php` and the folders `assets`, `lib`, `pages`, `storage` and `tests` directly inside `manage`.
   - If they are inside a sub-folder instead, open it, select all, and **Move** them up into `manage`.
5. Delete the zip.

## 3. Business setup (3 minutes)

1. Open **https://YOUR-DOMAIN/manage/install.php**.
2. All server checks should show a tick.
3. Choose **MySQL** and enter the database name, username and password from step 1. The host is `localhost`.
4. Fill in the business details:
   - **Business name** (the only required one)
   - Phone and address
   - Currency (INR is the default)
   - Business opening date
   - Number of vehicles
   - How you usually charge (per day, per month, or a fixed amount)
5. Create the **owner login**: name, email and password.
6. Click **Set up**, then delete `install.php` in File Manager.
7. Sign in at **https://YOUR-DOMAIN/manage**.

Everything you entered can be changed later in **Settings → Business**.

## 4. Hourly reminders (2 minutes, recommended)

1. In the app, open **Settings → Automatic checks** and copy the line `php /home/…/cron.php`.
2. In hPanel, open **Advanced → Cron Jobs → Custom**, paste the line and choose **Every hour**.

This keeps the alerts current and makes a backup every day, even when nobody is signed in.

## 5. Daily use

| When | Where | What to do |
|---|---|---|
| Once, at the start | **Cars → Add car** | Add each car with its km reading and prices. Then open the car → **Service & documents** and enter the insurance and PUC expiry dates. |
| A new customer | **Customers → Add customer** | Name and phone are enough. |
| A customer takes a car | **Rentals → New rental** | Choose the customer and car and the dates (the price is worked out for you). Enter the advance and deposit. Choose "hand over the car now", then enter the starting km and existing scratches. |
| The customer pays more | Open the rental → **Record payment** | Part payments are fine. |
| The customer wants more days | Open the rental → **Extend trip** | Write the agreed extra charge and the terms. |
| The car comes back | Open the rental → **Return the car** | Enter the final km, the condition, any new damage, and the money received. |
| See who owes money | **Money Due** | |
| Service and papers | **Maintenance & Documents** | Use "Mark service done" or "Update expiry date" on each reminder. |

## Staff accounts

Go to **Settings → Team → Add a team member** and tick what they may do. By default staff **cannot** see:
- money amounts
- Money Due
- reports
- settings
- customers' licence and ID numbers

Only the owner can cancel a payment or approve a damage charge.

## Backups

**Settings → Backup → Back up now**, then **Download**. Do this once a week and keep the file on your phone or in Google Drive.

## Problems

| You see | Do this |
|---|---|
| "Could not connect to the database" | Re-check the name, username (with the `u123…_` prefix) and password. |
| A cross next to "Folder can be written" | File Manager → right-click `manage` → Permissions → 755. Do the same for `storage`. |
| "Something went wrong" | Nothing was saved. Try again; if it repeats, send the time shown to your developer. |
| Forgot the password | Another owner can reset it in Settings → Team. Otherwise ask your developer. |
