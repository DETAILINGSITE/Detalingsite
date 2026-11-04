# Phone booking assistant (Vapi)

The phone assistant lives in Vapi, not in this repo. This file records how it is set up so it can be rebuilt.

- Assistant: `MJELITEDETAILING` (published v5), number +1 (304) 277 6078
- Model: GPT-4.1, voice Elliot (Vapi), transcriber Soniox
- Tools: `google_calendar_check_availability_tool` and `google_calendar_tool` (Vapi's built-in Google Calendar integration)
- Calendar: "MJ Elite Detailing Bookings" (timezone America/Chicago)

## How bookings work

1. The assistant collects package, vehicle, name, phone, and a day and time.
2. It checks availability once, then collects the address and ZIP and reads everything back.
3. It creates one calendar event for the package length: Bronze 2.5 h, Silver 3.5 h, Gold 4.5 h, VIP 7 h.
4. The calendar tool only saves the event title and time, so everything goes in the title, separated by " - ":
   `Gold - 2021 Toyota Camry (car) - Jane Smith - 832-555-0123 - 1505 Main St, Houston, TX 77002 - pet hair removal`
5. It only says "booked" after the tool succeeds. On failure it says the team will call back.

Owner alerts: turn on notifications for the booking calendar in the Google Calendar app.

## Business details in the script

- Hours: Mon-Fri 8 AM-6 PM, Sat 8 AM-4 PM, closed Sunday. Phone 832-250-7430.
- 100% mobile, Houston and surrounding areas, no travel fee, no deposit (pay when the work is done), 24 hours' notice for changes.
- Packages (car / truck, SUV, van): Bronze $75 / $95, Silver $150 / $170, Gold $200 / $220, VIP $450 / from $550.
- Add-ons: engine bay $20, headlight restoration $45, ceramic coating from $100, pet hair from $30, mud or sand from $25.
- VIP Maintenance Membership: $1,200-$1,500 per year. Not booked on the calendar; the team follows up.

If prices or hours change on the site, update the Vapi system prompt to match.
