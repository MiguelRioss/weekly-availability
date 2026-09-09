# Weekly Availability

A React + Vite weekly availability scheduler for MIGUEL, JOAO, TOME, and PEDRO.

## Features

- Four fixed users, each with a distinct color.
- Monday to Sunday timetable with one-hour slots.
- Click any slot to toggle availability for the selected user.
- Multiple users in one slot are shown as separate colored sections.
- All-four overlaps are highlighted and listed below the timetable.
- Availability is saved in `localStorage`, so refreshing the same browser keeps the schedule.

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

This first version stores data in each browser. To share live availability across different devices, add a small backend or hosted database such as Supabase.
