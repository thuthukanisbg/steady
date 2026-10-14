# Steady — diabetes companion (PWA for Netlify)

## Deploy (5 minutes)
1. Push this folder to a GitHub repo, then in Netlify: Add new site → Import from Git (build settings are in netlify.toml).
   (Or from this folder: `npm i && npx netlify deploy --prod`.)
2. Site settings → Environment variables (needed only for email):
   - RESEND_API_KEY  (free account at resend.com)
   - MAIL_FROM       e.g. "Steady <alerts@yourdomain.co.za>" (verify the domain in Resend; the default onboarding@resend.dev only mails the Resend account owner)
3. Open the site on her phone → Profile → Family sync → Create. Share code + PIN, then Join on your phone.
4. Add to Home Screen (iPhone: Share → Add to Home Screen; Android: Install).

Without step 2 the app and live sync still work; only emails are off.
