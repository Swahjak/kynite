# Wall Hub Hardware Research

Research synthesis for the physical device that runs the family planner's wall-hub
layout (August 2026). Covers device choice, mounting, and charging accessories.
Ends with the final decision.

---

## Constraints that shaped the search

- **Placement**: inside an open cupboard, ~30cm height clearance, 40cm depth —
  device must sit forward (not against the back panel) so the depth behind it
  stays usable, and must be easily liftable off (no fixed/permanent mount).
- **Kids in the house**: the setup needs to survive being bumped/pushed without
  tipping — a light freestanding stand was ruled out in favor of a weighted,
  adjustable one.
- **Aesthetics**: thin profile, minimal visible cabling — one cable ideally, no
  wall-drilling beyond the mount point itself (this ruled out flush wall-panel
  chargers like Zilvex/Bravour, and reframed the whole search away from wall
  mounting toward a cupboard-shelf dock).
- **Software**: must run Fully Kiosk Browser (Android + Play Store required —
  this eliminated Amazon Fire tablets outright, since Fire OS has no Play Store).
- **First-party retail preferred**: even at a premium, over grey-market/
  marketplace-only stock.
- **Update longevity**: a device bought now should have a long remaining OS/
  security-update runway — this ruled out two refurbished/older candidates
  (Samsung Tab S7 FE, whose Samsung support ended July 2025; iPad Pro 12.9"
  2017, capped at iPadOS 17 and Apple-classified "vintage") and one older-gen
  Lenovo Idea Tab Pro whose own buyer reviews flagged short support.

## Device search

Started at 11" (matching the family's current device), widened to "bigger than
11", cheaper than 13-14"" once the 13-14" segment (Lenovo Idea Tab Pro Gen 2,
€449) proved a large price jump for marginal size gain.

Samsung's own Galaxy Tab A9+ — the obvious first pick — turned out to be
end-of-life at first-party retail: Samsung.com NL no longer lists it, Coolblue
shows every variant as "niet meer leverbaar"/"tijdelijk uitverkocht", and
tweakers.net pricewatch confirms it's down to 2 stores. Its successor, the
Galaxy Tab A11+, is healthy (32 stores, €209-309, 7 years of updates to 2032)
but still 11".

Using tweakers.net's tablet comparison tool (filtered by screen size, price,
and store count as a health signal) to systematically survey the 12-12.9"
segment turned up the **Xiaomi Redmi Pad 2 Pro**: 12.1", 2560x1600, Snapdragon
7s Gen 4, HyperOS 2 (Android 15 base) — 4 guaranteed major OS/HyperOS upgrades,
security updates to ~2029. Confirmed first-party buyable directly from Xiaomi's
own NL/BE web store (mi.com), not just resellers.

## Decision: Xiaomi Redmi Pad 2 Pro, Wi-Fi, 8GB/256GB

- **~€259-289** depending on retailer/colour (bol Plaza €259, Belsimpel €289,
  MediaMarkt €349; mi.com sells the 6GB variant direct but the 8GB was
  intermittently out of stock there).
- 12.1", 2560x1600, Snapdragon 7s Gen 4 — enough headroom for a Chromium kiosk
  browser running the Next.js dashboard's touch drag-and-drop calendar plus a
  service worker, without the 4GB-RAM risk flagged on cheaper alternatives.
- HyperOS ships with full Google Mobile Services (Play Store, etc.) on the
  Global ROM sold by the retailers above — grey-market China-ROM imports (not
  what we're buying) lack this.
- Native battery-protection toggle caps charging at 80% (Settings → Battery →
  Battery protection) — no separate app needed.
- Fully Kiosk Browser confirmed compatible; its built-in scheduled sleep/wake
  and front-camera motion detection cover the "screen off at 23:00, wake on
  motion" requirement natively.
- Box includes a cable but not a charger (no charger in EU boxes) — the
  in-box cable's connector type is unconfirmed (some sources say USB-A ended),
  so don't rely on it; buy the cable separately regardless.

## Mounting

Rejected in order: wall mounting generally (parked in favour of a cupboard
dock), in-wall/flush charging docks (Zilvex, Bravour — wall-mount only, no
freestanding version exists at consumer price), and a hanging arm bolted to
the shelf above (more moving parts than a stand resting on the shelf below,
not actually more stable).

**Settled on**: a freestanding, weighted, adjustable stand placed forward on
the shelf (not against the back panel), paired with a magnetic USB-C
quick-connect so the tablet lifts off in one motion without unplugging a
cable by hand.

- **UGREEN Tablet Stand** (up to 12.9", weighted metal base, double aluminium
  rod, cable cutout at the back) — ~€21.75.
  <https://www.amazon.nl/-/en/UGREEN-Tablet-Adjustable-Aluminium-inches/dp/B0BD4DB5YT>
- **Magtame 240W Magnetic USB-C Male-to-USB-C-Female Adapter, 90°** — the
  magnetic tip that stays in the tablet's port, angled so the cable runs
  sideways instead of straight out the back — €13.14.
  <https://www.amazon.nl/dp/B0CWGHXVFK>
- **Plain USB-C to USB-C cable, 1m** — ~€6.99 (any reputable brand; the tip
  above does the magnetic work, so the cable itself doesn't need to be
  magnetic).
- **25W USB-C PD charger** (no cable) — €7.99.
  <https://www.amazon.nl/dp/B0F9WHCF3B>

Accessories total: **~€49.87**. Device + accessories: **~€309-339**.

### Why not an integrated magnetic cable, or a Samsung-branded charger

Chose separate tip + plain cable over an all-in-one magnetic cable (e.g.
Magtame's own USB-C-to-USB-C cable) so a worn cable can be replaced on its own
without re-buying the magnetic mechanism. Passed on the Samsung 25W charger
(€10.08) for a generic PD 3.0 one with comparable review volume (332 ratings,
4.5★) at €7.99 — the tablet doesn't need branded-charger wattage headroom
beyond 25W (HyperOS caps input to whatever the port/battery accepts anyway).

## Explicitly rejected paths

- **Google Pixel Tablet + Charging Speaker Dock** (~€499) — the magnetic
  drop-in Hub Mode was exactly the target UX, but the price was judged
  overkill for a home setup.
- **RAM Mounts GDS/IntelliSkin pogo-dock system** — genuinely exists for the
  Tab A9+, but is B2B/enterprise gear: no listed consumer price, "2-6 week
  lead time for custom orders."
- **Zilvex/Bravour flush wall chargers** — real product, magnetic, AC-powered,
  but wall-mount only; no freestanding version at consumer price.
- **DIY magnetic USB-C connector on a cheap fold-flat stand** — the initial
  budget idea (~€300 total) that evolved into the current plan once we
  separated the magnetic tip from the cable.
