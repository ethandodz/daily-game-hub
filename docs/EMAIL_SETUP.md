# Reliable account emails (Supabase)

Sign-up confirmation and password-reset emails are sent by Supabase, not by the app.
Supabase's built-in sender is for testing: it sends only a few emails per hour and, on many
projects, only to members of your Supabase team. Friends then never receive their emails.
Connecting your own email service fixes that.

## 1. Point email links at the app

Supabase dashboard → your project → **Authentication → URL Configuration**

- **Site URL:** `https://ethandodz.github.io/daily-game-hub/`
- **Redirect URLs:** add `https://ethandodz.github.io/daily-game-hub/`

The app's "Forgot password?" asks Supabase to link back to this address; Supabase only
allows addresses on this list.

## 2. Create an email service account (Resend, free tier)

1. Sign up at https://resend.com.
2. **Domains → Add Domain.** You need a domain you own (for example `yourname.com`).
   Add the DNS records Resend shows at your domain registrar and wait for "Verified".
   (Without your own domain, Resend can only email your own address.)
3. **API Keys → Create API Key** with "Sending access". Copy it — it is shown once.

Any SMTP provider works (Postmark, SendGrid, Mailgun, Amazon SES); the steps are the same.

## 3. Connect it to Supabase

Supabase → **Authentication → Emails → SMTP Settings** → **Enable Custom SMTP**

| Field | Value (Resend) |
|---|---|
| Sender email | `no-reply@yourdomain.com` (on the verified domain) |
| Sender name | `Daily Game Hub` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the API key from step 2 |

Save. Keep the API key out of the app code and out of chat; it belongs only in this
Supabase setting.

## 4. Raise the email rate limit

Supabase → **Authentication → Rate Limits** → "Rate limit for sending emails".
With custom SMTP you can raise it (for example to 30 per hour).

## 5. Test

1. In the app, open **Log In / Create Account**, enter your email and tap **Forgot password?**.
2. The email should arrive within a minute (check spam the first time).
3. Open the link on the same device: the app signs you in and asks for a new password.

If nothing arrives, Supabase → **Logs → Auth** shows the send attempt and any SMTP error.
