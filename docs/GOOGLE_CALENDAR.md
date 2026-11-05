# Google Calendar sync

Every confirmed booking (website or admin) is added to the owner's Google Calendar within seconds. If a booking is moved, the event moves too, and a cancelled booking is removed. Each event lists the customer, their phone and email, the vehicle, the services and add-ons, the total, the deposit, the balance due, the address, access notes and a link to the booking in admin.

The code is on (`business.flags.googleCalendarSync = true` in `config/business.ts`). Nothing is sent to Google until the five settings below are in Vercel. This is a one-time setup that takes about 15 minutes.

## 1. Create the Google project (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> and sign in with the Google account whose calendar should get the bookings.
2. Create a project, for example "MJ Elite Website".
3. Go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
4. Go to **APIs & Services → OAuth consent screen** (shown as "Google Auth Platform" in some accounts):
   - User type **External**. App name "MJ Elite Website". Use your email for the support and developer contacts.
   - Under **Data access / Scopes**, add `https://www.googleapis.com/auth/calendar.events`.
   - Under **Audience**, click **Publish app** so it shows **In production**. You don't need to submit it for Google verification. Leave it in "Testing" and Google expires the key from step 2 after 7 days, and the sync stops.
5. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Save it. Keep the **Client ID** and **Client secret** for step 3.

## 2. Get the refresh token (OAuth Playground)

1. Open <https://developers.google.com/oauthplayground>.
2. Click the gear icon (top right), tick **Use your own OAuth credentials**, and paste the Client ID and Client secret.
3. In the box under the scope list on the left, type `https://www.googleapis.com/auth/calendar.events` and click **Authorize APIs**.
4. Sign in with the same Google account. Google warns that the app "hasn't been verified"; that's expected for your own app, so click **Advanced → Go to MJ Elite Website**, then **Allow**.
5. Click **Exchange authorization code for tokens** and copy the **Refresh token**.

## 3. Add the settings in Vercel

Vercel → project **detalingsite** → **Settings → Environment Variables**. Add these for the **Production** environment:

| Name | Value |
|---|---|
| `GCAL_ENABLED` | `1` |
| `GOOGLE_CLIENT_ID` | Client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | Client secret from step 1 |
| `GOOGLE_REFRESH_TOKEN` | Refresh token from step 2 |
| `GCAL_CALENDAR_ID` | `primary` for your main calendar, or a separate calendar's ID (Google Calendar → that calendar's **Settings → Integrate calendar → Calendar ID**) |

Then go to **Deployments**, open the latest production deployment's **⋯** menu, and choose **Redeploy** so the new settings take effect.

## 4. Check it

Make a test booking on the website (or create one in admin). It should appear in Google Calendar within a minute. If it doesn't:

- Check that all five settings are in Vercel for **Production** and that you redeployed afterwards. If any of them is missing, the sync quietly does nothing.
- In Vercel → **Logs**, search for `Google token refresh failed` or `GCal`. `Google token refresh failed: 400` means the refresh token was revoked or expired; redo step 2. This happens if the app was left in "Testing". A `GCal upsert 404` or `403` usually means the wrong `GCAL_CALENDAR_ID`, or a calendar this Google account can't edit. Failed syncs are retried automatically.
- Bookings confirmed before the sync was set up are not copied over. Only new or changed bookings are sent.
