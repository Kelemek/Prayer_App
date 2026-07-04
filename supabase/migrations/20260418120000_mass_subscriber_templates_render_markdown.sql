-- Mass-subscriber emails use one variables dict for both HTML and text bodies.
-- Reference Html/Text variants for rich-text prayer content.

UPDATE public.email_templates
SET html_body = replace(
      html_body,
      '<p style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">{{prayerDescription}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">{{prayerDescriptionHtml}}</div>'
    ),
    text_body = replace(text_body, '{{prayerDescription}}', '{{prayerDescriptionText}}'),
    updated_at = now()
WHERE template_key = 'approved_prayer';

UPDATE public.email_templates
SET html_body = replace(
      replace(
        html_body,
        '<p style="margin: 0 0 15px 0;">{{prayerDescription}}</p>',
        '<div style="margin: 0 0 15px 0;">{{prayerDescriptionHtml}}</div>'
      ),
      '<p style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 0;">{{updateContent}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 0;">{{updateContentHtml}}</div>'
    ),
    text_body = replace(
      replace(text_body, '{{prayerDescription}}', '{{prayerDescriptionText}}'),
      '{{updateContent}}', '{{updateContentText}}'
    ),
    updated_at = now()
WHERE template_key = 'approved_update';

UPDATE public.email_templates
SET html_body = replace(
      replace(
        html_body,
        '<p style="margin: 0 0 15px 0;">{{prayerDescription}}</p>',
        '<div style="margin: 0 0 15px 0;">{{prayerDescriptionHtml}}</div>'
      ),
      '<p style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin: 0;">{{updateContent}}</p>',
      '<div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin: 0;">{{updateContentHtml}}</div>'
    ),
    text_body = replace(
      replace(text_body, '{{prayerDescription}}', '{{prayerDescriptionText}}'),
      '{{updateContent}}', '{{updateContentText}}'
    ),
    updated_at = now()
WHERE template_key = 'prayer_answered';
