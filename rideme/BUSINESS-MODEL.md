# OPIIUS: business model

One platform where riders compare and book bikes, scooters and self-drive cars from every
rental company in a city. Start in Guwahati, then Shillong, then the Northeast circuit.

Demo: `index.html` (site root) (three tabs: rider marketplace, partner app, business model with a
revenue calculator).

## 1. The problem on each side

**Riders (mostly tourists)**
- Rental companies live on Instagram and WhatsApp. A rider has to message five of them to compare.
- No way to tell a reliable company from a bad one before handing over a ₹5,000–₹15,000 deposit.
- Arriving at the airport or railway station, there is no easy way to have a vehicle waiting.
- One-way trips (Guwahati → Shillong) and Inner Line Permits (Arunachal, Nagaland) are hard to arrange.

**Rental companies**
- Vehicles sit idle on weekdays and off-season. An idle day earns ₹0.
- A small company cannot rank on Google for "bike rental Guwahati".
- Many already have booking software (as the agency owner said), so they will not switch tools.

## 2. Market signals

- India car rental market: about US$3.1 billion in 2025, growing 12–14% a year to 2033–34 (IMARC, Renub, Expert Market Research).
- Assam recorded over 1 crore tourist visits in 2023-24; Northeast footfall reached 1.25 crore in 2023, up from 70 lakh in 2014.
- Guwahati is the most searched destination in the Northeast and the gateway to Shillong, Kaziranga, Tawang and Ziro.
- Post-pandemic demand for self-drive two-wheelers in Guwahati has grown, and a dozen-plus small operators now compete there with no common marketplace.

## 3. What comparable platforms charge

| Platform | Model | Supplier's cost |
|---|---|---|
| Zoomcar | Private owners list cars | Host keeps ~60% of rent; ₹999 joining fee; ₹499/month GPS |
| OYO | Hotel franchise + marketplace | 20–30% of booking value |
| Royal Brothers | Own fleet + franchise partners | Partner invests in bikes under the brand |
| **OPIIUS** | Marketplace of existing rental companies | **12–15% of rent, only on bookings OPIIUS brings** |

OPIIUS can charge less than Zoomcar because it does not provide the cars, GPS or insurance. The
rental company does the operations; OPIIUS brings customers, payments and trust.

## 4. Revenue streams (ranked by profit)

| # | Stream | Who pays | Price | Why it matters |
|---|---|---|---|---|
| 1 | Booking commission | Rental company | 12% at launch → 15% at scale, on rent only | Core, scales with every booking |
| 2 | OPIIUS Protect | Rider | ₹99/day bike, ₹249/day car | Highest margin (~40% kept after insurer). Halves the deposit, which is the rider's biggest fear |
| 3 | Convenience fee | Rider | ₹49 bike, ₹99 car per booking | Pure margin, covers DL check and support |
| 4 | Partner Pro | Rental company | ₹1,499/month, optional | Top placement, WhatsApp booking bot, full partner app |
| 5 | Trip add-ons | Rider / hotel | ₹30–₹300 per booking | Permit assistance, gear, one-way drop fee, homestay affiliate commission |
| 6 | Delivery | Rider | ₹199 bike, ₹399 car | Kept by the rental company; drives conversion at airport and station |

Example: a Royal Enfield Classic 350 for 2 days at ₹1,200/day with Protect.
Rider pays ₹2,400 rent + ₹198 Protect + ₹49 fee = ₹2,647.
OPIIUS keeps ₹288 commission + ₹49 fee + ₹79 Protect margin − ₹53 gateway = **₹363 (≈13.7%)**.
Rental company gets ₹2,112 for a booking it would not otherwise have had.

## 5. Sample monthly numbers (assumptions, not a forecast)

20 companies × 15 vehicles, OPIIUS fills 6 extra days per vehicle per month, ₹1,400 average
daily rent, 2.5-day trips, 12% commission, 45% take Protect, 30% on Partner Pro:

| Line | Monthly |
|---|---|
| Rent booked through OPIIUS | ₹25.2 L |
| Bookings | 720 |
| Commission | ₹3.02 L |
| Protect margin | ₹0.52 L |
| Convenience fee | ₹0.50 L |
| Add-ons | ₹0.22 L |
| Partner Pro | ₹0.09 L |
| Less payment gateway (2% of everything collected) | −₹0.54 L |
| **OPIIUS net revenue** | **≈ ₹3.8 L / month (≈ ₹46 L / year)** |

Before salaries, marketing and damage claims above the Protect pool. The calculator on the demo's
Business model tab recomputes this live.

## 6. Rules that protect the profit

1. **Take every payment on OPIIUS.** Controlling money flow is what stops rental companies taking
   repeat riders off-platform. Pay partners T+1 after pick-up. Hide the rider's phone number until the booking is paid.
2. **Never pay minimum guarantees.** OYO's guarantees to hotels scaled with supply, not demand,
   and caused heavy losses. OPIIUS pays only per booking.
3. **Grow margin through Protect, not higher commission.** A 45% attach rate earns more than
   raising commission 2 points and does not upset partners.
4. **Stay asset-light.** Never buy vehicles. Every vehicle belongs to a partner.
5. **Own what national apps ignore:** one-way Guwahati ⇄ Shillong across partner hubs, permits for
   Tawang and Ziro, festival-season pricing (Bihu, Durga Puja, Hornbill, Ziro Music Festival).
6. **Buy demand cheaply.** Pay hostel and hotel front desks a small fee per booking (for example
   ₹100) instead of paying for ads. Rank on Google for "bike rental Guwahati", "Shillong self drive car".
7. **Reward staying on the platform.** Reviews, DL-verified once, deposit protection and dispute
   handling only exist for bookings made on OPIIUS.

## 7. Answering "we already have software"

OPIIUS does not replace their software. It sits on top as a sales channel:
- Connect their existing system (two-way availability sync), or
- Mark vehicles busy in a Google Sheet or calendar, or
- Use the free OPIIUS partner app, or
- Just accept bookings on WhatsApp.

## 8. Rollout

| Phase | When | Goal |
|---|---|---|
| Guwahati, supply first | Months 0–3 | 15–20 companies, 250+ vehicles, 0% commission for 60 days for founding partners, airport/station delivery, 5 bookings/day |
| Add Shillong, revenue on | Months 4–9 | One-way trips, Protect and fee live, 30 referral desks, 25 bookings/day |
| Northeast circuit | Months 10–18 | Tawang, Siliguri–Gangtok, Dimapur; Partner Pro and permits; 80 bookings/day |

## 9. The partnership

Settle this in writing before building:
- **You:** product, tech, payments, marketing site and SEO.
- **Partner (agency owner):** signs up rental companies, sets quality rules, handles disputes and on-ground operations.
- Equity split with vesting (for example 4 years, 1-year cliff) so neither side is locked to someone who stops working on it.
- His own fleet can list at 0% commission as a founding partner; it doubles as the first proof to other companies.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Rental companies take riders off-platform | Payments on OPIIUS, masked numbers, Protect and reviews only on-platform |
| Damage disputes | Photo check-in and check-out in the partner app; Protect pool with an insurer |
| Double booking | Availability sync or one-tap switch-off in the partner app |
| Seasonality (monsoon lull) | Monthly rentals for students and workers in the off-season |
| Regulation | Only list vehicles with valid commercial rental permits (yellow/black plates); keep DL checks |

## Sources

- [Zoomcar host help](https://www.zoomcar.com/in/host/en/help)
- [Zoomcar host fees](https://myinvestmentideas.com/host-car-on-zoomcar-earn-upto-40000-per-month-is-it-safe/)
- [Zoomcar business model](https://www.thebusinessscroll.com/zoomcar-business-model/)
- [Contrary Research: OYO](https://research.contrary.com/company/oyo)
- [OYO revenue sharing with hotel partners](https://www.markhub24.com/post/oyo-s-revenue-sharing-model-with-hotel-partners-from-aggregator-to-franchise-and-the-road-to-profit)
- [Royal Brothers: partner with us](https://www.royalbrothers.com/partner-with-us)
- [IMARC: India car rental market](https://www.imarcgroup.com/india-car-rental-market)
- [Mordor Intelligence: India car rental market](https://www.mordorintelligence.com/industry-reports/india-car-rental-market)
- [Assam Tribune: 1 crore tourist footfall 2023-24](https://assamtribune.com/assam/assam-witnesses-over-1-cr-tourist-footfall-in-2023-24-cm-1552980)
- [Organiser: Northeast footfall 1.25 crore in 2023](https://organiser.org/2024/11/29/267258/bharat/assam-tourist-footfall-in-northeast-surges-to-1-25-cr-in-2023-attributed-to-infrastructure-growth-govt-initiatives/)
- [Assam Tribune: two-wheeler rentals in Guwahati](https://assamtribune.com/article/self-driving-two-wheeler-rental-services-in-guwahati-rent-a-bike-or-scooter-here-1435241)
