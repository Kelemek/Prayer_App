-- Transactional signup mail: drop promo-sounding subjects/copy so providers
-- are less likely to file these as junk. Reminders and broadcasts are unchanged.

UPDATE public.email_templates
SET
  subject = 'Your Church setup link from Prayer App',
  html_body = $html$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    You requested this Church setup link from the Prayer App.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">
          <tr>
            <td bgcolor="#39704D" style="background-color:#39704D;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Church setup link</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{recipientEmail}},</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">You asked the Prayer App to email this link so you can finish Church setup in a browser. This is not a newsletter.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Church plan: <strong>{{pricing_display}}</strong>. This link expires on {{expiresAt}}.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{web_url}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open Church setup</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
                Or paste this address in your browser:<br>
                <a href="{{web_url}}" style="color:#39704D;text-decoration:underline;">{{web_url}}</a>
              </p>
              <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">Prayer App sent this because you tapped Email me a link to set up.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  text_body = $text$Your Church setup link from Prayer App

You asked the Prayer App to email this link so you can finish Church setup in a browser. This is not a newsletter.

{{web_url}}

Church plan: {{pricing_display}}
This link expires on {{expiresAt}}.

Prayer App sent this because you tapped Email me a link to set up.
$text$,
  description = 'Native Church tour email. Variables: pricing_display, web_url, expiresAt, recipientEmail. Transactional — no unsubscribe footer. Platform From.'
WHERE template_key = 'church_signup_web';

UPDATE public.email_templates
SET
  subject = 'Your Pro setup link from Prayer App',
  html_body = $html$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    You requested this Pro setup link from the Prayer App.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">
          <tr>
            <td bgcolor="#39704D" style="background-color:#39704D;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Pro setup link</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{recipientEmail}},</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">You asked the Prayer App to email this link so you can finish Pro setup in a browser. This is not a newsletter.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Pro plan: <strong>{{pricing_display}}</strong>. This link expires on {{expiresAt}}.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{web_url}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open Pro setup</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
                Or paste this address in your browser:<br>
                <a href="{{web_url}}" style="color:#39704D;text-decoration:underline;">{{web_url}}</a>
              </p>
              <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">Prayer App sent this because you tapped Email me a link to set up.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  text_body = $text$Your Pro setup link from Prayer App

You asked the Prayer App to email this link so you can finish Pro setup in a browser. This is not a newsletter.

{{web_url}}

Pro plan: {{pricing_display}}
This link expires on {{expiresAt}}.

Prayer App sent this because you tapped Email me a link to set up.
$text$,
  description = 'Native Pro tour email. Variables: pricing_display, web_url, expiresAt, recipientEmail. Transactional — no unsubscribe footer. Platform From.'
WHERE template_key = 'pro_signup_web';
