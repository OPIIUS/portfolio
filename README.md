# OPIIUS

A trust-first local marketplace for rental vehicles only: self-drive cars and cars with driver (bikes and tempo travellers
appear once an agency offers them). Customers compare local rental agencies in Guwahati; agencies showcase their fleets and
receive inquiries on WhatsApp. Tours were retired in October 2026: /tours/ and /onboard-tours.html now redirect.

Live: https://opiius.online/

## How the site is built
Static pages, generated from the data files. No framework, no server.

- `assets/opiius/data.js`: real partner agencies, vehicles and day prices (plus places, brands and models)
- `assets/opiius/partners.js`: agencies added through onboard.html; an optional `driver` block lists cars with driver and their rates
- `assets/opiius/partners.js`: rental agencies added through `onboard.html`
- `assets/opiius/config.js`: WhatsApp number and booking-log URL
- `assets/site/`: shared design system (`site.css`) and behaviour (`site.js`)
- `tools/build-site.mjs`: writes every marketplace page and `sitemap.xml`

After changing any data file, rebuild and commit the result:

    node tools/build-site.mjs

Pages: home (video background, two options: Self-drive cars and Cars with driver, the agencies, and a moving brand line), `rentals/` (agencies by rental type),
`rentals/self-drive-cars/<city>/`, `rentals/brands/<brand>/`, `agency/<slug>/` (one per partner), `for-agencies/`, `verification/`,
`about/`, `get-matched/`, `404.html`. `terms.html`, the onboarding forms and `dashboard.html` are hand-written.

Other projects in this repo (`business.html`, `global.html`, `demos/`, `coaching/`, `profile.html`, `rideme/`,
`agency/hotels.html`) are not linked from the marketplace.
