UPDATE campaigns AS campaign
SET type = 'group_announcement'
FROM message_templates AS template
WHERE campaign.type = 'newsletter'
  AND campaign.channel = 'email'
  AND template.id = campaign.template_id
  AND template.practice_id = campaign.practice_id
  AND length(template.name) > length(' - ' || campaign.name)
  AND right(template.name, length(' - ' || campaign.name)) = ' - ' || campaign.name
  AND jsonb_array_length(
    CASE
      WHEN jsonb_typeof(campaign.audience_filter->'groupIds') = 'array'
        THEN campaign.audience_filter->'groupIds'
      ELSE '[]'::jsonb
    END
  ) = 1
  AND EXISTS (
    SELECT 1
    FROM groups AS patient_group
    WHERE patient_group.practice_id = campaign.practice_id
      AND patient_group.id::text = campaign.audience_filter->'groupIds'->>0
  );
