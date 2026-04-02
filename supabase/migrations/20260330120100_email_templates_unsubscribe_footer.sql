-- Idempotent: add {{unsubscribe_url}} footer for personalized list/transactional templates.
-- prayer_reminder is updated in send-prayer-reminders (append when subscriber token exists).

UPDATE public.email_templates
SET
  html_body = replace(
    html_body,
    '</body>',
    '<p style="margin-top:20px;font-size:12px;color:#6b7280;text-align:center;"><a href="{{unsubscribe_url}}" style="color:#2563eb;">Unsubscribe from these emails</a></p></body>'
  ),
  text_body = text_body || E'\n\nUnsubscribe from these emails:\n{{unsubscribe_url}}\n',
  updated_at = now()
WHERE template_key IN (
  'approved_prayer',
  'approved_update',
  'prayer_answered',
  'user_hourly_prayer_reminder',
  'requester_approval',
  'denied_prayer',
  'denied_update',
  'update_author_approval',
  'account_approval_request',
  'subscriber_welcome',
  'admin_notification_prayer',
  'admin_notification_update',
  'admin_notification_deletion'
)
AND position('{{unsubscribe_url}}' in html_body) = 0;
