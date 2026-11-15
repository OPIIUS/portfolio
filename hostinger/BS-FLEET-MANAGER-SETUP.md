# Put the BS Fleet Manager on Hostinger (step by step)

The fleet manager will open at **https://bscarrental.co.in/manage**. Only people with an account can open it. The public website stays exactly as it is.

Total time: about 20 minutes.

---

## Step 1: Create the database (3 minutes)

1. Log in to **hPanel** → **Websites** → choose **bscarrental.co.in** → **Manage**.
2. In the left menu, open **Databases** → **Management**.
3. Under **Create a new MySQL database and database user**, fill in:
   - **Database name:** `fleet` (Hostinger adds a prefix, e.g. `u123456789_fleet`)
   - **Username:** `fleet` (it becomes e.g. `u123456789_fleet`)
   - **Password:** click the generate button and **copy it somewhere safe**
4. Click **Create**.
5. Write down the three full values shown in the list: database name, username and password. The host is `localhost`.

## Step 2: Upload the files (5 minutes)

1. In hPanel, open **Files** → **File Manager**, then open the **public_html** folder.
2. Click **New folder** and name it `manage`. Open it.
3. Click **Upload** and choose **`bs-fleet-manager.zip`**.
4. Right-click the zip → **Extract**. In "Extract to", type a single dot `.` so the files land directly inside `manage`.
5. Check the folder. Inside `public_html/manage` you should see `index.php`, `install.php`, `cron.php` and the folders `assets`, `lib`, `pages`, `storage`, `tests`.
   - If you see a single folder called `bs-fleet-manager` instead, open it, select everything, then **Move** it up into `manage`.
6. Delete the zip file.

## Step 3: Run the setup (3 minutes)

1. Open **https://bscarrental.co.in/manage/install.php** in your browser.
2. Every line in the server check should have a green tick.
3. Choose **MySQL**, then enter the database name, username and password from Step 1. Host: `localhost`.
4. Enter the business name, phone, and the **owner's** name, email and password. This is the main login, so use a strong password.
5. Click **Set up**. When you see "Setup is complete", go back to File Manager and **delete `install.php`**. It has already locked itself, but deleting it is cleaner.
6. Open **https://bscarrental.co.in/manage** and sign in.

## Step 4: Turn on the hourly cron job (3 minutes)

The cron job checks for alerts and makes the daily backup even when nobody is signed in.

1. In the fleet manager, go to **Settings → Alerts & integrations** and copy the line that starts with `php /home/...cron.php`.
2. In hPanel, open **Advanced** → **Cron Jobs**.
3. Choose **Custom**, paste the command (keep the `php ` at the start), and choose **Every hour**.
4. Save. After an hour, **Last cron run** on that settings page should show a time.

## Step 5: Fill it in (the owner)

1. **Settings → Business:** address and phone (these are printed on receipts).
2. **Settings → Documents:** tick which categories need Fitness, Permit and Road tax. Insurance, PUC and RC are already required for all vehicles. Ask your RTO if you are unsure.
3. **Fleet → Add vehicle** for each car and scooter. Then open its **Documents** tab and add insurance, PUC and RC with expiry dates. Add the last service km and date so service reminders work.
4. **Settings → Team:** create an account for each staff member and tick what they may do. By default staff cannot see money or reports.
5. **Settings → Backup:** download a backup every week and keep it on your phone or Google Drive.

## Optional: a short address (manage.bscarrental.co.in)

hPanel → **Domains** → **Subdomains** → create `manage`, and point its folder to `public_html/manage`. SSL is added automatically within a few minutes.

## Optional: email alerts

**Settings → Alerts & integrations** → tick "Email me new alerts" → enter the address → **Send a test email**. The first emails may land in spam; mark them "Not spam".

## If something goes wrong

| What you see | What to do |
|---|---|
| "Could not connect to the database" | Re-check the database name and username **including the `u123…_` prefix**, and the password. |
| Red cross for "Folder can be written" | File Manager → right-click `manage` → **Permissions** → set to 755. Do the same for `storage`. |
| Forgot the owner password | Another owner can reset it in Settings → Team. If you are the only owner, ask your developer: it can be reset from the database in 2 minutes. |
| Page says "Something went wrong" | Nothing was saved from that action. Note the time shown and send it to your developer. |
| Need to start again | Delete `config.php` in the `manage` folder, empty the database (hPanel → phpMyAdmin → drop all tables), and run install.php again. **This erases all data.** |
