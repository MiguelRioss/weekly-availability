# Weekly Unavailability

A React + Vite weekly unavailability scheduler for MIGUEL, JOAO, TOME, and PEDRO.

## Features

- Four fixed users, each with a distinct color.
- Monday to Sunday timetable with one-hour slots.
- Click any slot to toggle when the selected user is not available.
- Multiple unavailable users in one slot are shown as separate colored sections.
- Hours where all four are unavailable are highlighted and listed below the timetable.
- Unavailability is saved in `localStorage`, so refreshing the same browser keeps the schedule.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Render Static Site Settings

- Build command: `npm install && npm run build`
- Publish directory: `dist`

This first version stores data in each browser. To share live unavailability across different devices, add a small backend or hosted database such as Supabase.
