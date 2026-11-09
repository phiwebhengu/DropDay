# Drop Day

**Every release worth waiting for, in one place.** Drop Day is a release radar for games, films, TV, anime and manga: see what's dropping, follow it, and log what you've played, watched or read.

**Live site:** https://phiwebhengu.github.io/DropDay/

Built for DIGA3009A Interactive Media IIIB at Wits University (2026) from my approved PRD and Figma design.

## What you can do

- **Browse what's coming** by month, platform and genre, across games, films, TV, anime and manga.
- **Open any release** for its trailer, release date, where to watch, play or read, and similar titles.
- **Keep a Library:**
  - four lists: Want to, In progress, Done, Dropped
  - ratings, reviews and reminders for upcoming drops
  - episode tracking, with quick ways to mark a whole season or "watched up to" an episode
- **No account needed.** Your Library is saved in your browser, and you can download a backup.
- **Dark or light,** following your device until you pick one.
- **Works on phones,** with a bottom nav, sheets instead of dialogs, and 44px touch targets.
- **Respects reduced motion,** and every animation has a calm version.

## Pages

| Page       | File            | What it's for                                                                               |
| ---------- | --------------- | ------------------------------------------------------------------------------------------- |
| Home       | `index.html`    | The featured billboard with trailer previews, a countdown, and shelves of upcoming releases |
| Discover   | `discover.html` | Browse and search by category, month, platform and genre                                    |
| Game       | `game.html`     | One game: trailer, screenshots, editions, similar games, your log                           |
| Title      | `title.html`    | One film, show, anime or manga: episodes, where to watch or read, your log                  |
| My Library | `library.html`  | Your lists, stats, recent activity and backup                                               |

## Built with

- **HTML, CSS and JavaScript (ES modules):** no framework and no build step. What's in the repo is what GitHub Pages serves.
- **[GSAP](https://gsap.com/)** with ScrollTrigger and Flip, for the five planned motion moments.
- **Cloudflare Workers** for the game data proxy ([`proxy/igdb-worker.js`](proxy/igdb-worker.js)).
- **GitHub Pages** hosting, deployed from `main`.

### Data sources

| Source                                                       | Used for                                           | Key                             |
| ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------- |
| [TMDB](https://www.themoviedb.org/)                          | Films and TV, cinemas in South Africa, title logos | Read-only token                 |
| [AniList](https://anilist.co/)                               | Anime, manga and manhwa                            | None                            |
| [IGDB](https://www.igdb.com/)                                | Games, through Drop Day's Cloudflare Worker        | Secret, held by the Worker only |
| [YouTube Data API](https://developers.google.com/youtube/v3) | Fallback trailer search for games                  | Restricted to this site         |

Every API's answer is turned into one `Release` shape (`js/api/normalise.js`), so pages never depend on a single API. That's how games moved from RAWG to IGDB in a day when RAWG went down.

## Run it locally

1. Clone the repo:
   ```bash
   git clone https://github.com/phiwebhengu/DropDay.git
   ```
2. Open the folder in VS Code and start **Live Server** on `index.html`, on port **5500**.
3. Visit `http://127.0.0.1:5500/`.

Port 5500 matters: the game data Worker only answers the live site and Live Server on that port.

## Project structure

```
DropDay/
├── index.html, discover.html, game.html, title.html, library.html
├── css/
│   ├── tokens.css      design tokens (colour, type, spacing, motion)
│   ├── base.css        resets and page basics
│   ├── components.css  shared pieces (cards, buttons, header, toasts)
│   └── pages.css       page layouts
├── js/
│   ├── api/            one client per data source, the cache and the normaliser
│   ├── pages/          one module per page
│   ├── store/          the Library, saved in localStorage
│   ├── ui/             shared components
│   ├── utils/          dates, HTML and media helpers
│   ├── motion.js       motion moments M1–M5
│   └── config.js       API addresses and settings
├── proxy/
│   └── igdb-worker.js  Cloudflare Worker for IGDB
├── assets/icons/
└── docs/
```

## How it was built

Work is planned as GitHub issues and built on its own branch (`feature/…`, `fix/…` or `docs/…`). Each branch goes into `dev` through a pull request, which is squash merged. Releases go `dev` → `staging` → `main`, and `main` is protected.

- [Development log](docs/development-log.md): what was built when, and what went wrong
- [Design decisions](docs/design-decisions.md): every change from the PRD, with reasons and evidence
- [`v1-prd-build`](https://github.com/phiwebhengu/DropDay/tree/v1-prd-build): the build exactly as the PRD planned it, before user testing

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Game data is from IGDB, and anime and manga data from AniList. Fonts: Figtree and Big Shoulders Display (Google Fonts).

Design, build and documentation by **Phiwe Bhengu** ([GitHub](https://github.com/phiwebhengu), [LinkedIn](https://www.linkedin.com/in/phiwebhengu)). AI assistance (Claude, by Anthropic) was used during the build. How it was used is set out in my AI declaration.
