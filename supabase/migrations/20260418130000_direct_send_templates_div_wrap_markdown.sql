-- Direct-send templates inject sanitized HTML into {{prayerDescription}} /
-- {{updateContent}}. Markdown output is block-level; <p> wrappers break layout
-- in strict email clients. Use <div> instead.

UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">{{prayerDescription}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">{{prayerDescription}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'admin_notification_prayer';

UPDATE public.email_templates
SET html_body = regexp_replace(
      html_body,
      '<p\s+style="[^"]*"\s*>\s*\{\{updateContent\}\}\s*</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">{{updateContent}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'admin_notification_update';

UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">{{prayerDescription}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">{{prayerDescription}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'denied_prayer';

UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">{{updateContent}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">{{updateContent}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'denied_update';

UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">{{prayerDescription}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">{{prayerDescription}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'requester_approval';

-- requester_approval nested green box variant
UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="margin: 0; color: #047857;">{{prayerDescription}}</p>',
      '<div style="margin: 0; color: #047857;">{{prayerDescription}}</div>'
    ),
    updated_at = now()
WHERE template_key = 'requester_approval';
