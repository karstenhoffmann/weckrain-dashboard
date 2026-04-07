# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weckrain Dashboard is a single-page weather/activity monitoring dashboard for a home in 74653 (Weckrain). It displays sensor activity across time slots for kitchen (Küche), reading room (Lesezimmer), entrance (Eingang), and birdsong (Gesang). The entire app lives in a single `index.html` file — there is no build system, bundler, or package manager.

## Architecture

- **This repo is frontend-only.** Backend (Code.gs), hardware setup, and full documentation are separate.
- **Single-file app**: Everything (HTML, CSS, React components, logic) is in `index.html` (874 lines)
- **Runtime-transpiled React**: Uses React 18 + Babel standalone from CDN (`<script type="text/babel">`) — no JSX build step
- **Backend**: Google Apps Script (Code.gs) polls sensors via Fritz!Box AHA-HTTP-Interface every 30 min, logs to Google Sheets, and serves a JSON API (`?format=json&pw=<password>`)
- **Hosting**: GitHub Pages with custom domain `weckrain.derkarsten.de` (CNAME → karstenhoffmann.github.io)
- **Language**: UI is entirely in German
- **Concept**: Displays sensor data as an anonymized "weather station" — only insiders know what it really monitors

## Key Concepts

- **Time Slots (SLOTS)**: Day is divided into 6 slots — Nachts (00-04), Morgens (04-08), Vormittags (08-12), Mittags (12-14), Nachmittags (14-18), Abends (18-24)
- **Sensors**: `k`=Küche (FRITZ!DECT 200/Wasserkocher), `s`=Lesezimmer (FRITZ!DECT 200/Fernseher), `e`=Eingang (FRITZ!DECT 350/Haustür), `g`=Gesang (Fritz!Fon X6/Anrufliste). Values: `true` (active), `false` (inactive), `"offline"`, `"fehler"` (error), or `null` (no data)
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
3. Deploy by pushing to `main` — GitHub Pages deploys automatically

## Auth

Password-protected: prompted on first visit, stored in localStorage. The password is configured in the Google Apps Script Config sheet (`DASHBOARD_PW`). Can also be passed via URL param `?pw=`.

## Conventions

- Color constants are in the `C` object; sky themes in `SKY`
- All inline styles (no CSS classes beyond the initial `<style>` block)
- Mobile responsiveness via `useIsMobile()` hook (breakpoint at 520px) and `mob` boolean threaded through components
- Animations use CSS transitions and SVG `<animate>` elements, plus a custom `useAnimatedValue` hook
