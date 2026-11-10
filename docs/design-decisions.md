# Design decisions

Every deliberate difference between the live build and the approved PRD, with the reason and the evidence.

**Baseline:** the PRD submitted on 14 October 2026, its sitemap, wireframes and user flows, and the Figma file `kYrr3dNzxzjwwf45WTvo4y` (pages 04 Hi-Fi Desktop and 05 Hi-Fi Mobile). The build kept the PRD's page list, core flows, motion moments M1–M5 and its accessibility and performance targets as the base. Tag [`v1-prd-build`](https://github.com/phiwebhengu/DropDay/tree/v1-prd-build) is the last release built straight from the PRD (27 October 2026).

**Types**

- **Added:** not in the PRD
- **Changed:** in the PRD, done differently
- **Cut:** in the PRD or planned, then removed
- **Improved:** same feature, better quality
- **Deferred:** asked for, saved for after the exam

## Index

| ID                                                             | Decision                                           | Type       | Area              | Evidence                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------- | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| [D01](#d01-game-data-moved-from-rawg-to-igdb)                  | Game data moved from RAWG to IGDB                  | Changed    | API               | [#104](https://github.com/phiwebhengu/DropDay/pull/104)                                                          |
| [D02](#d02-anime-and-manga-from-anilist)                       | Anime and manga from AniList                       | Added      | API               | [#82](https://github.com/phiwebhengu/DropDay/pull/82)                                                            |
| [D03](#d03-trailers-from-the-youtube-data-api)                 | Trailers from the YouTube Data API                 | Added      | API               | [#72](https://github.com/phiwebhengu/DropDay/pull/72)                                                            |
| [D04](#d04-one-set-of-library-lists-for-every-medium)          | One set of Library lists for every medium          | Changed    | Library           | [#81](https://github.com/phiwebhengu/DropDay/pull/81)                                                            |
| [D05](#d05-visual-design-v1-then-v2)                           | Visual design v1, then v2                          | Improved   | Global            | [#72](https://github.com/phiwebhengu/DropDay/pull/72), [#79](https://github.com/phiwebhengu/DropDay/pull/79)     |
| [D06](#d06-light-theme-that-follows-the-system)                | Light theme that follows the system                | Added      | Global            | [#72](https://github.com/phiwebhengu/DropDay/pull/72), [#79](https://github.com/phiwebhengu/DropDay/pull/79)     |
| [D07](#d07-home-hero-became-a-billboard-with-trailer-previews) | Home hero became a billboard with trailer previews | Changed    | Home              | [#84](https://github.com/phiwebhengu/DropDay/pull/84), [#93](https://github.com/phiwebhengu/DropDay/pull/93)     |
| [D08](#d08-motion-m2-pinned-strip-replaced)                    | Motion M2: pinned strip replaced                   | Changed    | Motion            | [#76](https://github.com/phiwebhengu/DropDay/issues/76)                                                          |
| [D09](#d09-floating-glass-header-and-bottom-nav)               | Floating glass header and bottom nav               | Improved   | Global            | [#95](https://github.com/phiwebhengu/DropDay/pull/95)                                                            |
| [D10](#d10-detail-pages-for-films-tv-anime-and-manga)          | Detail pages for films, TV, anime and manga        | Added      | Pages             | [#97](https://github.com/phiwebhengu/DropDay/pull/97)                                                            |
| [D11](#d11-cards-open-the-full-page)                           | Cards open the full page                           | Changed    | Flow              | [#98](https://github.com/phiwebhengu/DropDay/pull/98)                                                            |
| [D12](#d12-in-cinemas-now-without-booking-links)               | In cinemas now, without booking links              | Added, Cut | Home              | [#77](https://github.com/phiwebhengu/DropDay/issues/77)                                                          |
| [D13](#d13-release-reminders-saved-on-this-device)             | Release reminders, saved on this device            | Added      | Library           | [#81](https://github.com/phiwebhengu/DropDay/pull/81)                                                            |
| [D14](#d14-adult-titles-hidden)                                | Adult titles hidden                                | Added      | Global            | [#80](https://github.com/phiwebhengu/DropDay/pull/80), [#104](https://github.com/phiwebhengu/DropDay/pull/104)   |
| [D15](#d15-episode-tracking-and-bulk-marking)                  | Episode tracking and bulk marking                  | Added      | Title pages       | [#97](https://github.com/phiwebhengu/DropDay/pull/97), [#119](https://github.com/phiwebhengu/DropDay/pull/119)   |
| [D16](#d16-quieter-activity-panel-and-backup-link)             | Quieter Activity panel and backup link             | Improved   | Library           | [#119](https://github.com/phiwebhengu/DropDay/pull/119)                                                          |
| [D17](#d17-official-title-logos)                               | Official title logos                               | Improved   | Home, title pages | [#109](https://github.com/phiwebhengu/DropDay/pull/109)                                                          |
| [D18](#d18-phone-layouts-and-touch-targets)                    | Phone layouts and touch targets                    | Improved   | Global            | [#71](https://github.com/phiwebhengu/DropDay/pull/71), [#99](https://github.com/phiwebhengu/DropDay/pull/99)     |
| [D19](#d19-accessibility-fixes)                                | Accessibility fixes                                | Improved   | Global            | [#73](https://github.com/phiwebhengu/DropDay/pull/73)                                                            |
| [D20](#d20-custom-lists-and-steam-data)                        | Custom lists and Steam data                        | Cut        | Scope             | Planning, 21 Oct                                                                                                 |
| [D21](#d21-saved-for-after-the-exam)                           | Saved for after the exam                           | Deferred   | Scope             | User feedback                                                                                                    |
| [D22](#d22-performance-pass-from-lighthouse)                   | Performance pass from Lighthouse                   | Improved   | Global            | [#133](https://github.com/phiwebhengu/DropDay/pull/133), [#137](https://github.com/phiwebhengu/DropDay/pull/137) |
| [D23](#d23-screenshots-open-full-size)                         | Screenshots open full size                         | Added      | Game page         | [#142](https://github.com/phiwebhengu/DropDay/pull/142)                                                          |
| [D24](#d24-iphone-layout-and-smoother-phones)                  | iPhone layout and smoother phones                  | Improved   | Global            | [#142](https://github.com/phiwebhengu/DropDay/pull/142), [#147](https://github.com/phiwebhengu/DropDay/pull/147) |

## Feedback that shaped these decisions

- **Lecturer feedback on the PRD** (30 October 2026)
- **Live-site survey:** a Google Form sent to friends, tutors and lecturers, over 22 responses by 28 October 2026 ([#34](https://github.com/phiwebhengu/DropDay/issues/34))
- **Friend testers** on WhatsApp (27 October 2026)
- **Tutor feedback** on the exam build (November 2026)
- **The lecturer's approval** by email of the changes, including the API change (November 2026)
- **My own testing** on desktop (Firefox, Windows) and phone

---

## D01 Game data moved from RAWG to IGDB

- **Type:** Changed, API
- **PRD:** RAWG for games.
- **Now:** IGDB (owned by Twitch), served through Drop Day's own Cloudflare Worker ([`proxy/igdb-worker.js`](../proxy/igdb-worker.js)).
- **Why:**
  - Many RAWG covers were missing or cropped screenshots instead of official box art.
  - From about 6 November 2026, RAWG went down completely (Cloudflare error 522 on both the API and the site), so every game section was empty.
  - IGDB has official covers, artwork, release types and "hype" counts for anticipated games.
- **How it stays safe:** IGDB needs a secret Twitch key and blocks browsers, so the Worker holds the key as a Cloudflare secret. It only answers three fixed questions (a list, a search, one game), only to the live site and Live Server, and saves its answers for 1 to 6 hours to stay well inside IGDB's limit.
- **Kept working:** games saved while the site used RAWG are found again on IGDB by name and moved over automatically.
- **Evidence:** [#85](https://github.com/phiwebhengu/DropDay/pull/85), [#88](https://github.com/phiwebhengu/DropDay/pull/88), [#103](https://github.com/phiwebhengu/DropDay/issues/103), [#104](https://github.com/phiwebhengu/DropDay/pull/104); the lecturer was told by email, with a screenshot of the outage, and approved the change.

## D02 Anime and manga from AniList

- **Type:** Added, API (anime moved off TMDB)
- **PRD:** TMDB for films, TV and anime. No manga.
- **Now:** AniList for anime and manga/manhwa: release feeds, search, genres, details, episodes and where to watch or read.
- **Why:** TMDB files anime as TV, with weak premiere dates and often no English title. Testers asked for manga and manhwa. AniList is free, needs no key and has an adult flag (see D14).
- **Evidence:** [#82](https://github.com/phiwebhengu/DropDay/pull/82), [#83](https://github.com/phiwebhengu/DropDay/pull/83)

## D03 Trailers from the YouTube Data API

- **Type:** Added, API
- **Why:** RAWG only had Steam clips, so most upcoming games had no trailer for the hero. TMDB and IGDB trailers are used first now, and YouTube search is the fallback.
- **Safety:** the key is limited to the site's addresses and to the YouTube Data API only. Results are kept for a week, because each search uses a large share of the free daily quota.
- **Evidence:** [#72](https://github.com/phiwebhengu/DropDay/pull/72)

## D04 One set of Library lists for every medium

- **Type:** Changed, Library
- **PRD:** game lists: Played, Playing, Backlog and Radar.
- **Now:** Want to, In progress, Done and Dropped, for games, films, TV, anime and manga. Each medium gets its own wording ("Want to watch", "Reading").
- **Why:** game-only words made no sense once films, shows and manga could be saved. Four lists that work for everything are easier to learn.
- **Kept working:** old libraries are moved to the new format automatically, and the original data is kept as a backup.
- **Evidence:** [#81](https://github.com/phiwebhengu/DropDay/pull/81)

## D05 Visual design v1, then v2

- **Type:** Improved, Global
- **v1 (24 Oct):** replaced the violet and lime gradient look with a warmer palette and new type. It added poster-first cards and a billboard hero.
- **v2 (from 29 Oct):** an Apple TV/Netflix-inspired pass. Figtree for interface text, Big Shoulders Display for marquee moments, full uncropped posters, glass surfaces and a new favicon.
- **Why:** the survey and my own review found the first look generic and "bleak, not memorable". Streaming apps (Apple TV, Netflix, Crunchyroll, Disney+) were studied for detail, especially the hero, while keeping the PRD layouts.
- **Evidence:** [#42](https://github.com/phiwebhengu/DropDay/issues/42), [#72](https://github.com/phiwebhengu/DropDay/pull/72), [#76](https://github.com/phiwebhengu/DropDay/issues/76), [#79](https://github.com/phiwebhengu/DropDay/pull/79), [#92](https://github.com/phiwebhengu/DropDay/pull/92)

## D06 Light theme that follows the system

- **Type:** Added, Global
- **Now:** dark and light themes. The site follows the device setting until a theme is picked with the header toggle, and the choice is remembered. It's set before the page paints, so there's no flash.
- **Why:** survey feedback, and it's expected of a modern site. Both themes are checked for contrast.
- **Evidence:** [#72](https://github.com/phiwebhengu/DropDay/pull/72), [#79](https://github.com/phiwebhengu/DropDay/pull/79)

## D07 Home hero became a billboard with trailer previews

- **Type:** Changed, Home layout
- **PRD:** a featured release with a countdown (motion M1).
- **Now:** a rounded billboard that rotates between featured releases. Each slide shows:
  - the release's official logo
  - a muted trailer preview
  - a soft glow made from the artwork
  - controls for the slides, pause and mute

  The countdown and M1's intro timeline are kept.

- **Why:** reference study of streaming heroes. It shows more upcoming releases without adding scroll, and keeps every motion and control accessible (pause, mute, reduced motion).
- **Evidence:** [#72](https://github.com/phiwebhengu/DropDay/pull/72), [#84](https://github.com/phiwebhengu/DropDay/pull/84), [#92](https://github.com/phiwebhengu/DropDay/pull/92), [#93](https://github.com/phiwebhengu/DropDay/pull/93)

## D08 Motion M2: pinned strip replaced

- **Type:** Changed, Motion
- **PRD:** M2, a pinned horizontal strip on Home.
- **Now:** M2 is the billboard change. The new art fades up out of a slight zoom while its details rise in, and reduced motion gets a plain fade. Shelves scroll normally.
- **Why:** testers found the pinned strip trapped their scrolling. Taking control of scroll from people works against the PRD's own accessibility goals.
- **Evidence:** [#27](https://github.com/phiwebhengu/DropDay/issues/27), [#76](https://github.com/phiwebhengu/DropDay/issues/76)

## D09 Floating glass header and bottom nav

- **Type:** Improved, Global
- **Now:** the header is a floating glass capsule that firms up on scroll, and the phone bottom nav matches. Focused items scroll clear of both bars.
- **Why:** a tester said the nav felt off-centre, and the full-width strip felt heavy against the billboard.
- **Evidence:** [#95](https://github.com/phiwebhengu/DropDay/pull/95), [#99](https://github.com/phiwebhengu/DropDay/pull/99)

## D10 Detail pages for films, TV, anime and manga

- **Type:** Added, Pages (`title.html`)
- **PRD:** a full page for games only. Everything else used the Quick view drawer.
- **Now:** every medium has a full page with:
  - status, log and review
  - trailer, reminder and share
  - where to watch or read
  - episodes (see D15)
  - More like this
- **Why:** tutor feedback asked for detail pages, and testers clicked cards expecting one.
- **Evidence:** [#96](https://github.com/phiwebhengu/DropDay/issues/96), [#97](https://github.com/phiwebhengu/DropDay/pull/97)

## D11 Cards open the full page

- **Type:** Changed, Flow
- **PRD:** clicking a card opened the Quick view.
- **Now:** clicking a card opens its full page. The Quick view is still there, behind a ⋯ button in the card's corner.
- **Why:** in testing, a click that opens a sidebar felt wrong. The web convention is that a card goes to its page.
- **Evidence:** [#98](https://github.com/phiwebhengu/DropDay/pull/98)

## D12 In cinemas now, without booking links

- **Type:** Added (shelf), Cut (booking links)
- **Now:** a Home shelf of films showing in South African cinemas (TMDB, region ZA).
- **Cut:** links to book at Ster-Kinekor and Nu Metro. The tutor advised against promising booking links without a real source for them. TMDB only says which films are showing in a region, not where or when, and I found no public source for Ster-Kinekor or Nu Metro showtimes, so the links could only have gone to a homepage.
- **Evidence:** [#77](https://github.com/phiwebhengu/DropDay/issues/77), tutor feedback (November 2026)

## D13 Release reminders, saved on this device

- **Type:** Added, Library
- **Now:** Remind me on upcoming releases. Reminded drops show on Home and in My Library.
- **Why:** it's the core promise of a release radar. Following tutor feedback, a note says reminders are kept on this device only, since there are no accounts or notifications.
- **Evidence:** [#81](https://github.com/phiwebhengu/DropDay/pull/81), [#97](https://github.com/phiwebhengu/DropDay/pull/97)

## D14 Adult titles hidden

- **Type:** Added, Global
- **Now:**
  - Games tagged Erotic on IGDB, or with explicit titles, are filtered out by the Worker.
  - AniList is asked for non-adult titles only.
  - TMDB adult results are dropped.
  - A direct link to an adult title shows "not found".
- **Why:** a tester found explicit games in the feed, and Drop Day is a general-audience site.
- **Evidence:** [#80](https://github.com/phiwebhengu/DropDay/pull/80), [#104](https://github.com/phiwebhengu/DropDay/pull/104)

## D15 Episode tracking and bulk marking

- **Type:** Added, Title pages
- **Now:** a grid of episodes per season, ticked off as watched, which moves the title to In progress. For long series:
  - mark the next episode
  - "Watched up to" an episode
  - a whole season or a 100-episode range at once
  - Shift-click a run of episodes

  Each of these can be undone.

- **Why:** Simkl-style tracking was a goal for v2. Marking One Piece (over 1,100 episodes) one tile at a time was tedious in my own testing.
- **Evidence:** [#97](https://github.com/phiwebhengu/DropDay/pull/97), [#118](https://github.com/phiwebhengu/DropDay/issues/118), [#119](https://github.com/phiwebhengu/DropDay/pull/119)

## D16 Quieter Activity panel and backup link

- **Type:** Improved, Library
- **PRD:** an Activity log and an "Export library (JSON)" button in the Library sidebar.
- **Now:** Activity shows the latest five changes, with Show more. Export is a small "Download a backup" link in the Library header. It's the same JSON file.
- **Why:** with a full library, the panel became long and crowded the page. Few people export, so a quiet link is enough.
- **Evidence:** [#23](https://github.com/phiwebhengu/DropDay/issues/23), [#119](https://github.com/phiwebhengu/DropDay/pull/119)

## D17 Official title logos

- **Type:** Improved, Home and title pages
- **Now:** films and shows show their own title logo from TMDB, as streaming apps do:
  - Dark logos are turned white on dark art.
  - SVG logos are swapped for TMDB's PNG copy, because an SVG with no set size was drawn at zero width (Wildwood).
  - The heading waits briefly for the logo instead of swapping text for a logo in view.
  - A logo that can't load falls back to the typed title, so a title is never blank.
- **Evidence:** [#108](https://github.com/phiwebhengu/DropDay/issues/108), [#109](https://github.com/phiwebhengu/DropDay/pull/109)

## D18 Phone layouts and touch targets

- **Type:** Improved, Global
- **Now:** checked at 390, 768, 1024 and 1440px. Phone gutters are 20px, and shelves size to the screen. Touch targets are at least 44px, and status buttons sit in a 2 × 2 grid on small screens.
- **Evidence:** [#31](https://github.com/phiwebhengu/DropDay/issues/31), [#71](https://github.com/phiwebhengu/DropDay/pull/71), [#99](https://github.com/phiwebhengu/DropDay/pull/99)

## D19 Accessibility fixes

- **Type:** Improved, Global
- **Now:** a keyboard, screen reader and contrast audit with fixes: focus order, labels, live regions, dialog focus and reduced motion. Later features followed the same checks.
- **Evidence:** [#32](https://github.com/phiwebhengu/DropDay/issues/32), [#73](https://github.com/phiwebhengu/DropDay/pull/73)

## D20 Custom lists and Steam data

- **Type:** Cut, Scope (21 October 2026)
- **Custom lists** (playlists, as on Letterboxd): cut to finish the core flows properly in the time left. The four Library lists cover the PRD's flows.
- **Steam and SteamDB data:** dropped. It only covers PC games and needed another key, and IGDB later covered what was needed.

## D21 Saved for after the exam

- **Type:** Deferred
- **Accounts and sign-in** (a tester suggested Supabase or Vercel), a **shared database for friends' reviews**, and **a phone app**: these need a backend, and the brief is a front-end build. The Library stays on the device, and its backup file is the bridge until then.
- **Separate month and year filters** on Discover: the month filter and quick ranges cover the current flows.
- **A "Show adult titles" setting:** hidden by default for now (D14).

## D22 Performance pass from Lighthouse

- **Type:** Improved, Global
- **PRD target:** Lighthouse mobile, performance 85+ and accessibility 95+.
- **Before** (9 November, mobile; Performance / Accessibility / Best Practices / SEO): Home 70 / 100 / 100 / 91, Discover 66 / 97 / 100 / 100, Library 85 / 100 / 100 / 100, film page 85 / 100 / 100 / 100, game page 74 / 100 / 100 / 100.
- **Causes found:** layout shift (the footer pushed down as content arrived, details growing line by line, the billboard's text and trailer button settling late) and the main picture arriving late (full-size art on phones, all five billboard slides downloading at once).
- **Now:**
  - The footer starts below the screen, detail heroes and the billboard appear once laid out, and the Discover summary keeps its line. Layout shift is 0 on the pages tested.
  - Phones get smaller billboard art. The first slide downloads alone at high priority, and the rest follow a second after it shows.
  - Discover's first row and detail-page covers load first, and connections to the image servers open early.
  - "More info" has a descriptive name for search engines and screen readers.
- **After:** Home 90 at best (86+ in 3 of 5 runs, range 79–90) / 100 / 100 / 100, Discover 85 / 97 / 100 / 100, Library 94 / 100 / 100 / 100, film page 92 / 100 / 100 / 100, game page 91 / 100 / 100 / 100. Both targets met.
- **Left as is:** Discover's 97 accessibility is one touch-target warning. On first load the floating bottom nav overlaps the ⋯ button on the first row of cards, and it clears once the page scrolls.
- **Evidence:** [#33](https://github.com/phiwebhengu/DropDay/issues/33), [#133](https://github.com/phiwebhengu/DropDay/pull/133), [#137](https://github.com/phiwebhengu/DropDay/pull/137)

## D23 Screenshots open full size

- **Type:** Added, Game page
- **Now:** tapping a screenshot opens it full size (1080p) in a viewer, one at a time. Arrows, swipe or the keyboard move between screenshots, a counter shows the position, and Escape, x or a tap outside closes it. Focus returns to the screenshot that opened it.
- **Why:** a tester asked why screenshots couldn't be opened bigger. On a phone the thumbnails are too small to see much.
- **Evidence:** [#141](https://github.com/phiwebhengu/DropDay/issues/141), [#142](https://github.com/phiwebhengu/DropDay/pull/142)

## D24 iPhone layout and smoother phones

- **Type:** Improved, Global
- **Problem:** testers on iPhone found every page wider than the screen. Content ran off the right edge and Manga was cut off. Others found Home laggy on their phone, and the Top 10 row didn't line up with the other rows.
- **Cause:** the page layouts are one-column grids. Safari let that column grow to fit its widest row (the category tabs), so the whole page overflowed. Chrome and Android browsers don't, which is why it only showed on iPhones.
- **Now:**
  - Every page column is limited to the screen, and pages can't scroll sideways on phones.
  - All five categories share the width on phones, so Manga is always visible.
  - The Top 10 numbers start at the page edge on phones, in line with the other rows.
  - The billboard rests when scrolled past: no trailer playing and no slides changing behind the shelves.
  - On phones, card buttons use a solid tint instead of frosted glass, and the film-grain texture is off, because both had to be redrawn on every scroll frame.
- **Evidence:** [#141](https://github.com/phiwebhengu/DropDay/issues/141), [#142](https://github.com/phiwebhengu/DropDay/pull/142), [#146](https://github.com/phiwebhengu/DropDay/issues/146), [#147](https://github.com/phiwebhengu/DropDay/pull/147); confirmed fixed by the iPhone tester
