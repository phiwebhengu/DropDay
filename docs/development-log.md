# Development log

How Drop Day went from the approved PRD to the exam build: what was built when, why, and what went wrong along the way. The reasoning behind each change from the PRD is in [design-decisions.md](design-decisions.md). This log is the story around it.

**Course:** DIGA3009A Interactive Media IIIB, Wits, 2026. Due 19 November 2026.
**Live site:** https://phiwebhengu.github.io/DropDay/

## At a glance

| Date      | Milestone                                                                        | Release                                                                                                          |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 14 Oct    | PRD submitted (marked on 30 Oct)                                                 | n/a                                                                                                              |
| 19 Oct    | Repo set up from scratch: foundation, design tokens, API layer                   | [#39](https://github.com/phiwebhengu/DropDay/pull/39)                                                            |
| 20–21 Oct | Discover, Quick view, Library store, toasts, save buttons                        | n/a                                                                                                              |
| 24 Oct    | Game page, log modal, My Library, Home, motion M1–M5, responsive pass, design v1 | n/a                                                                                                              |
| 26–27 Oct | Accessibility audit; first full release, tagged `v1-prd-build`                   | [#75](https://github.com/phiwebhengu/DropDay/pull/75)                                                            |
| 29–30 Oct | User testing fixes, Library v2, AniList, design v2, IGDB covers, floating header | [#90](https://github.com/phiwebhengu/DropDay/pull/90)                                                            |
| 6 Nov     | Detail pages for every medium, card actions, phone spacing                       | [#101](https://github.com/phiwebhengu/DropDay/pull/101)                                                          |
| 7 Nov     | RAWG outage: all game data moved to IGDB                                         | [#106](https://github.com/phiwebhengu/DropDay/pull/106)                                                          |
| 8 Nov     | Title logo fixes; repo clean-up                                                  | [#111](https://github.com/phiwebhengu/DropDay/pull/111), [#116](https://github.com/phiwebhengu/DropDay/pull/116) |
| 9 Nov     | Bulk episode marking; quieter Library activity                                   | [#121](https://github.com/phiwebhengu/DropDay/pull/121)                                                          |

## How the work was run

- **Issues first.** Every piece of work started as a GitHub issue with type, area and priority labels. Issues #1–#35 were the PRD's build plan, in order: foundation, then APIs, Discover, Library, the Game page, Home, motion, responsive, accessibility and release.
- **Branches.** `main` is the live site and is protected. `staging` is the check before release, and `dev` is where work comes together. Each issue gets its own branch from `dev`: `feature/…`, `fix/…` or `docs/…`, named after the issue.
- **Pull requests.** Each branch goes into `dev` through a PR that closes its issue, as a squash merge, so `dev` reads as one commit per change.
- **Releases.** `dev` → `staging` → `main` with merge commits, then `main` is merged back into `dev` so the branches never drift.
- **No build step.** Plain HTML, CSS and JavaScript modules, so what's in the repo is exactly what GitHub Pages serves.

## Phase 1: Foundation (19 October)

I restarted the repo from scratch on 19 October, to start the build cleanly from the PRD.

- Design tokens (colour, type, spacing, radius, motion) in `css/tokens.css`, and the shared page shell with header, footer and phone bottom nav ([#36](https://github.com/phiwebhengu/DropDay/pull/36)).
- The API layer: a small cache in front of every request, clients for RAWG and TMDB, and a **normaliser** that turns every API's answer into one `Release` shape. Pages only ever see a `Release`, which later made it possible to swap whole APIs without touching the pages ([#37](https://github.com/phiwebhengu/DropDay/pull/37)).
- Branch protection, labels and the first release to `main` ([#39](https://github.com/phiwebhengu/DropDay/pull/39)).

## Phase 2: Discover and saving (20–21 October)

- Release cards, the TMDB footer logo, Discover's category tabs and quick ranges, and filters for month, platform and genre that live in the URL, so a filtered view can be shared or bookmarked ([#40](https://github.com/phiwebhengu/DropDay/pull/40)–[#47](https://github.com/phiwebhengu/DropDay/pull/47)).
- **Loading, empty, error and offline states** for every list, from the course's "four states" standard ([#48](https://github.com/phiwebhengu/DropDay/pull/48)).
- Back restores the filters and scroll position, header search opens results, and the Quick view drawer arrived ([#49](https://github.com/phiwebhengu/DropDay/pull/49)–[#52](https://github.com/phiwebhengu/DropDay/pull/52)).
- The Library store in `localStorage`, toasts with View and Undo, and save buttons on cards ([#53](https://github.com/phiwebhengu/DropDay/pull/53)–[#55](https://github.com/phiwebhengu/DropDay/pull/55)).
- **Problem:** TV shows came back with premiere dates from decades ago, because TMDB lists any show with an episode in range. The fix keeps only real drops (a new show or a season premiere) and uses that date ([#15](https://github.com/phiwebhengu/DropDay/issues/15), [#44](https://github.com/phiwebhengu/DropDay/pull/44)).

## Phase 3: The rest of the PRD (24 October)

- The Game detail page with screenshots and similar games ([#56](https://github.com/phiwebhengu/DropDay/pull/56), [#57](https://github.com/phiwebhengu/DropDay/pull/57)).
- The Log and review modal on desktop, which becomes a bottom sheet on phones ([#58](https://github.com/phiwebhengu/DropDay/pull/58)).
- My Library: tabs, stats and rows, plus the Activity log, JSON export, and recovery if saved data is ever corrupted ([#59](https://github.com/phiwebhengu/DropDay/pull/59)–[#61](https://github.com/phiwebhengu/DropDay/pull/61)).
- Home: the countdown hero, This month, and Continue your Backlog ([#62](https://github.com/phiwebhengu/DropDay/pull/62)).
- **Motion M1–M5** with GSAP. `gsap.matchMedia` gives every animation a reduced-motion version ([#64](https://github.com/phiwebhengu/DropDay/pull/64)–[#70](https://github.com/phiwebhengu/DropDay/pull/70)):
  - M1: hero intro and ticking countdown
  - M2: pinned strip
  - M3: Flip on the Discover grid
  - M4: save feedback
  - M5: log modal and Library count-up
- The responsive pass at 390, 768, 1024 and 1440px ([#71](https://github.com/phiwebhengu/DropDay/pull/71)).
- **Design v1:** a new palette, type, billboard hero, posters and light theme. YouTube trailers were added, because RAWG only had Steam clips ([#72](https://github.com/phiwebhengu/DropDay/pull/72)).

## Phase 4: Accessibility and the first full release (26–27 October)

- A keyboard, screen reader and contrast audit with fixes ([#73](https://github.com/phiwebhengu/DropDay/pull/73)).
- Released to the live site and tagged **`v1-prd-build`**: the build exactly as the PRD planned it, before any testing feedback ([#74](https://github.com/phiwebhengu/DropDay/pull/74), [#75](https://github.com/phiwebhengu/DropDay/pull/75)).
- **User testing:** a Google Form on the live site went to friends, tutors and lecturers, with over 21 responses by 28 October. Friends also sent feedback on WhatsApp ([#34](https://github.com/phiwebhengu/DropDay/issues/34)).

## Phase 5: Design v2 and more media (29–30 October)

Testing said the site worked but felt generic, and people wanted more than games. This phase answered that ([#76](https://github.com/phiwebhengu/DropDay/issues/76)).

- Urgent fixes from testing, and the **adult content filter** after a tester found explicit games in the feed ([#79](https://github.com/phiwebhengu/DropDay/pull/79), [#80](https://github.com/phiwebhengu/DropDay/pull/80)).
- **Library v2:** Want to, In progress, Done and Dropped for every medium, with reminders. Old libraries move over automatically ([#81](https://github.com/phiwebhengu/DropDay/pull/81)).
- **AniList** for anime, manga and manhwa ([#82](https://github.com/phiwebhengu/DropDay/pull/82), [#83](https://github.com/phiwebhengu/DropDay/pull/83)).
- **Design v2**, inspired by Apple TV/Netflix: a billboard with muted trailer previews on every slide, an ambient glow from the art, and a floating glass header and bottom nav ([#84](https://github.com/phiwebhengu/DropDay/pull/84), [#92](https://github.com/phiwebhengu/DropDay/pull/92)–[#95](https://github.com/phiwebhengu/DropDay/pull/95)).
- **IGDB covers** through a Cloudflare Worker, because many RAWG covers were missing or cropped ([#85](https://github.com/phiwebhengu/DropDay/pull/85), [#88](https://github.com/phiwebhengu/DropDay/pull/88)).
- **Motion M2 changed:** the pinned strip trapped testers' scrolling, so M2 became the billboard change instead (D08).

## Phase 6: Detail pages and feedback (6 November)

- The **tutor's feedback** asked for detail pages. It also led to booking links being cut, and to a note that reminders are kept on this device only. The lecturers confirmed by email that the changes from the PRD were fine for the exam.
- Full pages for films, TV, anime and manga, with episode tracking ([#97](https://github.com/phiwebhengu/DropDay/pull/97)).
- Cards now open their full page, and the Quick view moved to a ⋯ button ([#98](https://github.com/phiwebhengu/DropDay/pull/98)).
- Phone layouts got more room, and focus is kept clear of the floating bars ([#99](https://github.com/phiwebhengu/DropDay/pull/99)).

## Phase 7: The RAWG outage (6–7 November)

From about 6 November, RAWG went down: Cloudflare error 522 on both its API and its website. Every game section on Drop Day was empty, with the exam two weeks away.

- **Decision:** move all game data to IGDB, which already supplied the covers, through the same Worker ([#103](https://github.com/phiwebhengu/DropDay/issues/103), [#104](https://github.com/phiwebhengu/DropDay/pull/104)).
- **The Worker:**
  - keeps the Twitch secret as a Cloudflare secret, never in the repo
  - answers only three fixed questions, and only to the live site and Live Server
  - filters adult games, DLC and vague dates
  - caches answers at the edge to respect IGDB's rate limit
- **Kept working:** games saved from RAWG are found again on IGDB by name and moved over.
- I emailed the lecturer about the change, with a screenshot of the outage.
- **Why it only took a day:** because pages only use normalised `Release` objects (Phase 1), only `js/api/games.js` and the normaliser had to change.

## Phase 8: Polish (8–9 November)

- **Missing titles:** Wildwood's title vanished on the billboard and its page. Its TMDB logo is an SVG with no set size, which the browser drew at zero width. The fix uses TMDB's PNG copy, turns dark logos white, and waits briefly for the logo instead of swapping text for it in view ([#108](https://github.com/phiwebhengu/DropDay/issues/108), [#109](https://github.com/phiwebhengu/DropDay/pull/109)).
- **Repo clean-up:** Wrangler's local cache file, with the Cloudflare account ID and email, had been committed with #104. It's removed and ignored now. It held no key ([#113](https://github.com/phiwebhengu/DropDay/issues/113), [#114](https://github.com/phiwebhengu/DropDay/pull/114)).
- **Bulk episode marking:** next episode, "watched up to", whole seasons or ranges, Shift-click runs, and Undo. The Library's Activity panel and export were made quieter ([#118](https://github.com/phiwebhengu/DropDay/issues/118), [#119](https://github.com/phiwebhengu/DropDay/pull/119)).

## What went wrong, and what I learnt

| Problem                                   | What I learnt                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| RAWG went down for days                   | Have a backup source, and keep API code behind one normalised shape so it can be swapped. |
| TMDB returned decades-old "upcoming" TV   | Test against real responses, not the docs (#15).                                          |
| An SVG logo drew at zero width            | One bad asset can break a layout silently; always have a fallback.                        |
| Explicit games in the feed                | Filter on the server where possible, and treat what an API returns as untrusted.          |
| The pinned strip trapped scrolling        | Motion that takes control from people fails user testing, even when it looks good.        |
| A local tool file was committed           | Check `git status` before committing, and ignore tool folders from day one.               |
| PRs opened the wrong way round (#86, #87) | Read base and compare before creating a PR.                                               |

## Still to do

- Lighthouse on mobile: performance 85+, accessibility 95+ ([#33](https://github.com/phiwebhengu/DropDay/issues/33))
- Final release and submission ([#35](https://github.com/phiwebhengu/DropDay/issues/35))
