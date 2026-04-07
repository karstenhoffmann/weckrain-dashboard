# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weckrain Dashboard is a single-page weather/activity monitoring dashboard for a home in 74653 (Weckrain). It displays sensor activity across time slots for kitchen (Küche), reading room (Lesezimmer), entrance (Eingang), and birdsong (Gesang). The entire app lives in a single `index.html` file — there is no build system, bundler, or package manager.

## Architecture

- **Single-file app**: Everything (HTML, CSS, React components, logic) is in `index.html` (874 lines)
- **Runtime-transpiled React**: Uses React 18 + Babel standalone from CDN (`<script type="text/babel">`) — no JSX build step
- **Backend**: Google Apps Script Web App (`API_URL` constant) serves JSON data via `?format=json&pw=<password>`
- **Hosting**: GitHub Pages with custom domain `weckrain.derkarsten.de` (see `CNAME`)
- **Language**: UI is entirely in German

## Key Concepts

- **Time Slots (SLOTS)**: Day is divided into 6 slots — Nachts (00-04), Morgens (04-08), Vormittags (08-12), Mittags (12-14), Nachmittags (14-18), Abends (18-24)
- **Sensor values**: Each slot has 4 sensors (`k`=Küche, `s`=Lesezimmer, `e`=Eingang, `g`=Gesang) with values: `true` (active), `false` (inactive), `"offline"`, `"fehler"` (error), or `null` (no data)
- **Sky themes (SKY)**: Each slot has a visual theme controlling sun position, star visibility, colors, etc.
- **Weather labels**: Derived from activity count — Freundlich (8+), Heiter (4+), Ruhig (1+), Neblig (0)

## Component Structure

- `App` — state manager (loading/login/error/ready), handles auth via localStorage and URL param `?pw=`
- `DashboardMain` — main view with day/slot selection, auto-refreshes every 10 minutes
- `House` — animated SVG house scene with sky, sun arc, windows lit by sensor state
- `MiniHouse` — compact SVG version for the weekly history grid
- `LoginScreen` / `LoadingScreen` — auth and loading states
- `LegendDot` — sensor status indicator

## Development

No build or test commands. To develop:
1. Edit `index.html` directly
2. Open in a browser (or serve with any static file server)
3. Deploy by pushing to the branch served by GitHub Pages

## Conventions

- Color constants are in the `C` object; sky themes in `SKY`
- All inline styles (no CSS classes beyond the initial `<style>` block)
- Mobile responsiveness via `useIsMobile()` hook (breakpoint at 520px) and `mob` boolean threaded through components
- Animations use CSS transitions and SVG `<animate>` elements, plus a custom `useAnimatedValue` hook
