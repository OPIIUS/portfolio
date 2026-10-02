# OPIIUS

A trust-first local marketplace: customers compare rental, tour, experience and event agencies in Guwahati and the
Northeast; agencies showcase their services and receive inquiries on WhatsApp.

Live: https://opiius.online/

## How the site is built
Static pages, generated from the data files. No framework, no server.

- `assets/opiius/data.js`: real partner agencies, vehicles and day prices (plus places, brands and models)
- `assets/opiius/partners.js`: agencies and tour operators added through `onboard.html` / `onboard-tours.html`
- `assets/opiius/config.js`: WhatsApp number and booking-log URL
- `assets/site/`: shared design system (`site.css`) and behaviour (`site.js`)
- `tools/build-site.mjs`: writes every marketplace page and `sitemap.xml`

After changing any data file, rebuild and commit the result:

    node tools/build-site.mjs

Pages: home, `rentals/` (with `rentals/self-drive-cars/<city>/` for live listings), `tours/`, `experiences/`,
`events/`, `travel-services/`, `agency/<slug>/` (one per partner), `for-agencies/`, `verification/`, `about/`,
`get-matched/`, `404.html`. `terms.html`, the onboarding forms and `dashboard.html` are hand-written.

Other projects in this repo (`business.html`, `global.html`, `demos/`, `coaching/`, `profile.html`, `rideme/`,
`agency/hotels.html`) are not linked from the marketplace.
