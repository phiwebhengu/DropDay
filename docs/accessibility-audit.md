# Accessibility audit (#32)

Target: WCAG 2.2 level AA (W3C, 2023). Tested on the `feature/32-accessibility-audit` branch, October 2026.

## 1. Automated scan

axe-core 4.10.2 (Deque Systems, 2024), run in Chromium through Playwright with the WCAG 2.0, 2.1 and 2.2 A/AA rule sets plus best practice.

Scope: Home, Discover, My Library (list, grid, diary and empty tab), Game detail, Game not found, the Log modal and the Quick view. Each was scanned in the dark and light themes, at desktop (1440 px) and mobile (390 px) widths, with a seeded Library.

| Finding | Where | Fix |
| --- | --- | --- |
| Heading levels skipped (h1 to h3) | Discover results, Library grid and list | Hidden `<h2>` before the results ("Results", or the list name) |
| No level-one heading | Game not found and error states | The page-level state message uses `<h1>` (`headingLevel: 1`) |

**After the fixes: 0 violations** across all 36 scans.

## 2. Checks a scanner can't do

| Check | Result |
| --- | --- |
| Keyboard: every page from the skip link to the footer | Every control reachable in a logical order; focus never lands on hidden content |
| Visible focus | Amber ring on every control. Cards and rows ring the whole card, because the whole card is clickable |
| Skip link | First stop on every page; moves focus into the main content |
| Dialogs (Log, Quick view) | Focus stays inside while open; Escape closes; focus returns to the button that opened it |
| Status radio group (Game detail) | Arrow keys move between options; one Tab stop for the group |
| Reflow at 320 px and 640 px (400% and 200% zoom) | No horizontal scrolling on any page or dialog |
| Touch targets | 44 × 44 px minimum on phones |
| Reduced motion | GSAP moments M1–M5 fall back to fades or no motion; trailers never start on their own |
| Toasts | Announced through a polite live region; they stay while hovered or focused (WCAG 2.2.1) |
| Spoilers | Hidden from screen readers too, until "Show spoiler" is pressed |
| Colour alone | The current page, selected tab and selected status all have a shape cue (underline bar or fill) as well as colour |

Fixed during this audit: the empty stars in the Log modal's rating input were about 1.2:1 against the card. They're the control itself, so they now use a token at 3.5:1 or better in both themes (WCAG 1.4.11).

## 3. Contrast

Checked to WCAG AA: 4.5:1 for text, 3:1 for focus rings and controls.

| Pair | Dark | Light |
| --- | --- | --- |
| Body text on page | 16.3 | 15.2 |
| Secondary text on cards | 6.9 | 6.9 |
| Amber text and links on page | 9.5 | 5.1 |
| Dark text on amber buttons | 9.9 | 9.9 |
| Error text on cards | 5.4 | 5.5 |
| Games label on page | 8.4 | 5.3 |
| Focus ring on page | 11.4 | 5.5 |
| Empty stars on cards | 3.5 | 3.5 |

## 4. Screen reader (NVDA + Firefox)

Fill this in after testing (Results: Pass, Fail or Notes).

| # | Task | Expected | Result |
| --- | --- | --- | --- |
| 1 | Open Home, press H to jump through headings | Page title, "Dropping this month", "Continue your Backlog" | |
| 2 | Press D to jump through landmarks | Banner, Main navigation, main, content info | |
| 3 | Save a game from a card | "Added … to Radar" is read out | |
| 4 | Discover: switch to Movies, then This week | Tab change and the result summary are read | |
| 5 | Open a movie's Quick view, then close it with Escape | Dialog name read on open; focus back on the title | |
| 6 | Game detail: arrow through Played, Playing, Backlog, Radar | Each read as a radio button with checked state | |
| 7 | Log a game: set 4.5 stars, write a review, save | Star value read as you move; success toast read | |
| 8 | My Library diary: reach a spoiler review | Spoiler text is not read; the "Show spoiler" button is | |
| 9 | Toggle the theme | Read as "Light theme, toggle button, pressed / not pressed" | |

## References

Deque Systems (2024) *axe-core* (version 4.10.2) [Software]. Available at: https://github.com/dequelabs/axe-core (Accessed: 26 October 2026).

W3C (2023) *Web Content Accessibility Guidelines (WCAG) 2.2*. Available at: https://www.w3.org/TR/WCAG22/ (Accessed: 26 October 2026).
