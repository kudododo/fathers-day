# Echo Garden Father’s Day MVP — Overview

## What We Are Building

A semi-automated Father’s Day gift creation flow.

The user does the creative generation work themselves:
- records with camera/mic or uploads audio/video
- generates up to 2 Echo Garden works
- compares them
- chooses 1 final work
- enters message/shipping data

The office team then handles:
- final check
- Canva CSV import
- printing
- photo print
- packing
- shipping

## Why This MVP Exists

The Mother’s Day operation proved that people will pay and emotionally engage with Echo Garden, but the office workload was too high because the team manually created the works.

This MVP reduces operation by moving the creative generation step to the user.

## MVP Boundary

This is not the final public product. It is a beta for approximately 100 users.

Do:
- keep token-based access
- keep spreadsheet/CSV-friendly operation
- keep Canva for now
- keep Cloudflare R2/D1 as the backend

Do not:
- build full login
- build full admin dashboard
- replace Canva
- fully automate Shopify
- attempt advanced person segmentation in this phase
