-- Optional IBCD memorization recommendations per tenant.
-- New tenants start with no recommendations; admins apply/remove IBCD catalog via RPC.

ALTER TABLE public.memorization_recommendation_categories
  ADD COLUMN IF NOT EXISTS catalog_source text;

ALTER TABLE public.memorization_recommendation_categories
  DROP CONSTRAINT IF EXISTS memorization_recommendation_categories_catalog_source_check;

ALTER TABLE public.memorization_recommendation_categories
  ADD CONSTRAINT memorization_recommendation_categories_catalog_source_check
  CHECK (catalog_source IS NULL OR catalog_source = 'ibcd');

ALTER TABLE public.memorization_recommendations
  ADD COLUMN IF NOT EXISTS catalog_source text;

ALTER TABLE public.memorization_recommendations
  DROP CONSTRAINT IF EXISTS memorization_recommendations_catalog_source_check;

ALTER TABLE public.memorization_recommendations
  ADD CONSTRAINT memorization_recommendations_catalog_source_check
  CHECK (catalog_source IS NULL OR catalog_source = 'ibcd');

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS memorization_ibcd_catalog_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.memorization_recommendation_categories.catalog_source IS
  'When ibcd, row came from the IBCD counseling catalog apply action';

COMMENT ON COLUMN public.memorization_recommendations.catalog_source IS
  'When ibcd, row came from the IBCD counseling catalog apply action';

COMMENT ON COLUMN public.tenant_settings.memorization_ibcd_catalog_applied IS
  'True after a tenant admin applies the IBCD memorization recommendation catalog';

-- Backfill IBCD tags on existing seeded data.
UPDATE public.memorization_recommendation_categories c
SET catalog_source = 'ibcd'
WHERE c.catalog_source IS NULL
  AND c.name IN (
    'Abuse',
    'Addictions',
    'Anger',
    'Assurance of Salvation',
    'Child Training',
    'Church Involvement',
    'Communication',
    'Conflict Resolution',
    'Decision Making',
    'Depression',
    'Divorce',
    'Facing Trials and Calamity',
    'Fear',
    'Finances',
    'General Principles',
    'Granting Forgiveness',
    'Integrity',
    'Lust',
    'Marriage',
    'Presenting the Gospel',
    'Repentance',
    'Resisting Temptation',
    'Revenge',
    'Sanctification',
    'Seeking Forgiveness',
    'Sex',
    'The Role of the Husband',
    'The Role of the Wife',
    'Work and Employment',
    'Worry'
  );

WITH ibcd_verse_seed (category_name, reference) AS (
  VALUES
    ('General Principles', '2 Timothy 3:16-17'),
    ('General Principles', 'Philippians 4:12'),
    ('General Principles', 'John 15:5'),
    ('Conflict Resolution', 'Matthew 5:9'),
    ('Conflict Resolution', 'Proverbs 18:13'),
    ('Conflict Resolution', 'Proverbs 18:17'),
    ('Conflict Resolution', 'Matthew 7:3-5'),
    ('Conflict Resolution', 'Galatians 6:1-2'),
    ('Conflict Resolution', 'Matthew 18:15-20'),
    ('Conflict Resolution', '1 Corinthians 6:1-8'),
    ('Conflict Resolution', 'Romans 12:18'),
    ('Anger', 'Matthew 5:21-22'),
    ('Anger', 'James 4:1-6'),
    ('Anger', 'Proverbs 25:28'),
    ('Revenge', 'Romans 12:19-21'),
    ('Revenge', 'Matthew 5:43-48'),
    ('Abuse', 'Hebrews 12:15'),
    ('Abuse', 'Genesis 50:19-20'),
    ('Communication', 'James 3:6-12'),
    ('Communication', 'Ephesians 4:29'),
    ('Communication', 'James 1:19-20'),
    ('Communication', 'Philippians 2:3-4'),
    ('Communication', 'Proverbs 15:1'),
    ('Resisting Temptation', '1 Corinthians 10:13'),
    ('Resisting Temptation', 'Genesis 39:7-10'),
    ('Lust', 'Matthew 5:27-30'),
    ('Lust', '2 Timothy 2:22'),
    ('Lust', 'Philippians 4:8-9'),
    ('Fear', 'Proverbs 29:25'),
    ('Fear', 'Jeremiah 17:5-8'),
    ('Worry', 'Matthew 6:25-34'),
    ('Worry', 'Philippians 4:6-7'),
    ('Depression', 'Psalms 32'),
    ('Depression', 'Philippians 4:11-13'),
    ('Addictions', 'Isaiah 55:1-2'),
    ('Addictions', '2 Timothy 3:4'),
    ('Addictions', 'Proverbs 23:29-35'),
    ('Facing Trials and Calamity', 'Romans 8:28'),
    ('Facing Trials and Calamity', 'James 1:2-4'),
    ('Facing Trials and Calamity', 'Romans 8:31-39'),
    ('Seeking Forgiveness', '1 John 1:8-10'),
    ('Seeking Forgiveness', 'Matthew 5:23-24'),
    ('Granting Forgiveness', 'Ephesians 4:32'),
    ('Granting Forgiveness', 'Matthew 18:21-35'),
    ('Repentance', '2 Corinthians 7:9-11'),
    ('Repentance', 'Psalms 51'),
    ('Presenting the Gospel', 'Romans 3:20-26'),
    ('Presenting the Gospel', 'Isaiah 53:4-6'),
    ('Presenting the Gospel', 'Luke 23:39-43'),
    ('Presenting the Gospel', 'Ephesians 2:8-9'),
    ('Assurance of Salvation', '1 John 5:1'),
    ('Assurance of Salvation', 'John 10:28-29'),
    ('Assurance of Salvation', '1 John 2:3-4'),
    ('Assurance of Salvation', '1 John 4:8-9'),
    ('Sanctification', '1 Corinthians 6:9-11'),
    ('Sanctification', 'Romans 6:11'),
    ('Sanctification', '2 Corinthians 5:17'),
    ('Sanctification', 'Philippians 1:6'),
    ('Sanctification', 'Philippians 2:12-13'),
    ('Sanctification', 'Ephesians 4:22-24'),
    ('Sanctification', 'Titus 2:14'),
    ('Church Involvement', 'Hebrews 10:25'),
    ('Church Involvement', 'Hebrews 13:17'),
    ('Church Involvement', '1 Peter 4:10-11'),
    ('Church Involvement', '1 Corinthians 16:2'),
    ('Work and Employment', 'Exodus 20:9'),
    ('Work and Employment', 'Proverbs 6:6-11'),
    ('Work and Employment', '2 Thessalonians 3:10'),
    ('Work and Employment', 'Ephesians 6:5-9'),
    ('Finances', 'Proverbs 21:5'),
    ('Finances', 'James 4:13-17'),
    ('Finances', 'Deuteronomy 8:18'),
    ('Finances', 'Proverbs 22:7'),
    ('Finances', 'Matthew 6:19-21'),
    ('Finances', '1 Timothy 6:10'),
    ('Finances', '1 Timothy 6:17-19'),
    ('Finances', 'Proverbs 3:9'),
    ('Finances', 'Matthew 22:17-21'),
    ('Decision Making', 'James 1:5'),
    ('Decision Making', 'Proverbs 15:22'),
    ('Decision Making', 'Deuteronomy 29:29'),
    ('Decision Making', 'Proverbs 16:9'),
    ('Decision Making', 'Proverbs 3:5-6'),
    ('Integrity', 'Matthew 5:37'),
    ('Integrity', 'Ephesians 4:25'),
    ('Marriage', 'Genesis 2:18-23'),
    ('Marriage', 'Genesis 2:24'),
    ('The Role of the Husband', 'Ephesians 5:25-30'),
    ('The Role of the Husband', '1 Peter 3:7'),
    ('The Role of the Husband', 'John 13:1-17'),
    ('The Role of the Wife', 'Ephesians 5:22-24'),
    ('The Role of the Wife', '1 Peter 3:1-6'),
    ('Sex', 'Hebrews 13:4'),
    ('Sex', 'Genesis 1:28'),
    ('Sex', '1 Corinthians 7:3-5'),
    ('Sex', 'Proverbs 5:18-19'),
    ('Child Training', 'Ephesians 6:1-3'),
    ('Child Training', 'Ephesians 6:4'),
    ('Child Training', 'Proverbs 19:18'),
    ('Divorce', 'Malachi 2:16'),
    ('Divorce', 'Matthew 19:5-6'),
    ('Divorce', 'Matthew 19:9'),
    ('Divorce', '1 Corinthians 7:15'),
    ('Divorce', '1 Corinthians 7:12')
)
UPDATE public.memorization_recommendations r
SET catalog_source = 'ibcd'
FROM public.memorization_recommendation_categories c
INNER JOIN ibcd_verse_seed vs
  ON vs.category_name = c.name
WHERE r.category_id = c.id
  AND r.reference = vs.reference
  AND r.catalog_source IS NULL;

UPDATE public.tenant_settings ts
SET memorization_ibcd_catalog_applied = true
WHERE EXISTS (
  SELECT 1
  FROM public.memorization_recommendations r
  WHERE r.tenant_id = ts.tenant_id
    AND r.catalog_source = 'ibcd'
);

-- New tenants: do not auto-seed memorization recommendations.
CREATE OR REPLACE FUNCTION public.seed_tenant_memorization_recommendations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
BEGIN
  RETURN NEW;
END;
$memrec$;

CREATE OR REPLACE FUNCTION public._merge_ibcd_memorization_catalog(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
DECLARE
  v_categories_added integer := 0;
  v_verses_added integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  WITH category_seed (name, display_order) AS (
    VALUES
      ('Abuse', 10),
      ('Addictions', 20),
      ('Anger', 30),
      ('Assurance of Salvation', 40),
      ('Child Training', 50),
      ('Church Involvement', 60),
      ('Communication', 70),
      ('Conflict Resolution', 80),
      ('Decision Making', 90),
      ('Depression', 100),
      ('Divorce', 110),
      ('Facing Trials and Calamity', 120),
      ('Fear', 130),
      ('Finances', 140),
      ('General Principles', 150),
      ('Granting Forgiveness', 160),
      ('Integrity', 170),
      ('Lust', 180),
      ('Marriage', 190),
      ('Presenting the Gospel', 200),
      ('Repentance', 210),
      ('Resisting Temptation', 220),
      ('Revenge', 230),
      ('Sanctification', 240),
      ('Seeking Forgiveness', 250),
      ('Sex', 260),
      ('The Role of the Husband', 270),
      ('The Role of the Wife', 280),
      ('Work and Employment', 290),
      ('Worry', 300)
  ),
  inserted_categories AS (
    INSERT INTO public.memorization_recommendation_categories (
      tenant_id,
      name,
      display_order,
      catalog_source
    )
    SELECT p_tenant_id, cs.name, cs.display_order, 'ibcd'
    FROM category_seed cs
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_categories_added FROM inserted_categories;

  WITH category_seed (name) AS (
    VALUES
      ('Abuse'),
      ('Addictions'),
      ('Anger'),
      ('Assurance of Salvation'),
      ('Child Training'),
      ('Church Involvement'),
      ('Communication'),
      ('Conflict Resolution'),
      ('Decision Making'),
      ('Depression'),
      ('Divorce'),
      ('Facing Trials and Calamity'),
      ('Fear'),
      ('Finances'),
      ('General Principles'),
      ('Granting Forgiveness'),
      ('Integrity'),
      ('Lust'),
      ('Marriage'),
      ('Presenting the Gospel'),
      ('Repentance'),
      ('Resisting Temptation'),
      ('Revenge'),
      ('Sanctification'),
      ('Seeking Forgiveness'),
      ('Sex'),
      ('The Role of the Husband'),
      ('The Role of the Wife'),
      ('Work and Employment'),
      ('Worry')
  ),
  all_categories AS (
    SELECT c.id, c.name
    FROM public.memorization_recommendation_categories c
    INNER JOIN category_seed cs ON cs.name = c.name
    WHERE c.tenant_id = p_tenant_id
  ),
  verse_seed (category_name, reference, display_order) AS (
    VALUES
      ('General Principles', '2 Timothy 3:16-17', 0),
      ('General Principles', 'Philippians 4:12', 1),
      ('General Principles', 'John 15:5', 2),
      ('Conflict Resolution', 'Matthew 5:9', 0),
      ('Conflict Resolution', 'Proverbs 18:13', 1),
      ('Conflict Resolution', 'Proverbs 18:17', 2),
      ('Conflict Resolution', 'Matthew 7:3-5', 3),
      ('Conflict Resolution', 'Galatians 6:1-2', 4),
      ('Conflict Resolution', 'Matthew 18:15-20', 5),
      ('Conflict Resolution', '1 Corinthians 6:1-8', 6),
      ('Conflict Resolution', 'Romans 12:18', 7),
      ('Anger', 'Matthew 5:21-22', 0),
      ('Anger', 'James 4:1-6', 1),
      ('Anger', 'Proverbs 25:28', 2),
      ('Revenge', 'Romans 12:19-21', 0),
      ('Revenge', 'Matthew 5:43-48', 1),
      ('Abuse', 'Hebrews 12:15', 0),
      ('Abuse', 'Genesis 50:19-20', 1),
      ('Communication', 'James 3:6-12', 0),
      ('Communication', 'Ephesians 4:29', 1),
      ('Communication', 'James 1:19-20', 2),
      ('Communication', 'Philippians 2:3-4', 3),
      ('Communication', 'Proverbs 15:1', 4),
      ('Resisting Temptation', '1 Corinthians 10:13', 0),
      ('Resisting Temptation', 'Genesis 39:7-10', 1),
      ('Lust', 'Matthew 5:27-30', 0),
      ('Lust', '2 Timothy 2:22', 1),
      ('Lust', 'Philippians 4:8-9', 2),
      ('Fear', 'Proverbs 29:25', 0),
      ('Fear', 'Jeremiah 17:5-8', 1),
      ('Worry', 'Matthew 6:25-34', 0),
      ('Worry', 'Philippians 4:6-7', 1),
      ('Depression', 'Psalms 32', 0),
      ('Depression', 'Philippians 4:11-13', 1),
      ('Addictions', 'Isaiah 55:1-2', 0),
      ('Addictions', '2 Timothy 3:4', 1),
      ('Addictions', 'Proverbs 23:29-35', 2),
      ('Facing Trials and Calamity', 'Romans 8:28', 0),
      ('Facing Trials and Calamity', 'James 1:2-4', 1),
      ('Facing Trials and Calamity', 'Romans 8:31-39', 2),
      ('Seeking Forgiveness', '1 John 1:8-10', 0),
      ('Seeking Forgiveness', 'Matthew 5:23-24', 1),
      ('Granting Forgiveness', 'Ephesians 4:32', 0),
      ('Granting Forgiveness', 'Matthew 18:21-35', 1),
      ('Repentance', '2 Corinthians 7:9-11', 0),
      ('Repentance', 'Psalms 51', 1),
      ('Presenting the Gospel', 'Romans 3:20-26', 0),
      ('Presenting the Gospel', 'Isaiah 53:4-6', 1),
      ('Presenting the Gospel', 'Luke 23:39-43', 2),
      ('Presenting the Gospel', 'Ephesians 2:8-9', 3),
      ('Assurance of Salvation', '1 John 5:1', 0),
      ('Assurance of Salvation', 'John 10:28-29', 1),
      ('Assurance of Salvation', '1 John 2:3-4', 2),
      ('Assurance of Salvation', '1 John 4:8-9', 3),
      ('Sanctification', '1 Corinthians 6:9-11', 0),
      ('Sanctification', 'Romans 6:11', 1),
      ('Sanctification', '2 Corinthians 5:17', 2),
      ('Sanctification', 'Philippians 1:6', 3),
      ('Sanctification', 'Philippians 2:12-13', 4),
      ('Sanctification', 'Ephesians 4:22-24', 5),
      ('Sanctification', 'Titus 2:14', 6),
      ('Church Involvement', 'Hebrews 10:25', 0),
      ('Church Involvement', 'Hebrews 13:17', 1),
      ('Church Involvement', '1 Peter 4:10-11', 2),
      ('Church Involvement', '1 Corinthians 16:2', 3),
      ('Work and Employment', 'Exodus 20:9', 0),
      ('Work and Employment', 'Proverbs 6:6-11', 1),
      ('Work and Employment', '2 Thessalonians 3:10', 2),
      ('Work and Employment', 'Ephesians 6:5-9', 3),
      ('Finances', 'Proverbs 21:5', 0),
      ('Finances', 'James 4:13-17', 1),
      ('Finances', 'Deuteronomy 8:18', 2),
      ('Finances', 'Proverbs 22:7', 3),
      ('Finances', 'Matthew 6:19-21', 4),
      ('Finances', '1 Timothy 6:10', 5),
      ('Finances', '1 Timothy 6:17-19', 6),
      ('Finances', 'Proverbs 3:9', 7),
      ('Finances', 'Matthew 22:17-21', 8),
      ('Decision Making', 'James 1:5', 0),
      ('Decision Making', 'Proverbs 15:22', 1),
      ('Decision Making', 'Deuteronomy 29:29', 2),
      ('Decision Making', 'Proverbs 16:9', 3),
      ('Decision Making', 'Proverbs 3:5-6', 4),
      ('Integrity', 'Matthew 5:37', 0),
      ('Integrity', 'Ephesians 4:25', 1),
      ('Marriage', 'Genesis 2:18-23', 0),
      ('Marriage', 'Genesis 2:24', 1),
      ('The Role of the Husband', 'Ephesians 5:25-30', 0),
      ('The Role of the Husband', '1 Peter 3:7', 1),
      ('The Role of the Husband', 'John 13:1-17', 2),
      ('The Role of the Wife', 'Ephesians 5:22-24', 0),
      ('The Role of the Wife', '1 Peter 3:1-6', 1),
      ('Sex', 'Hebrews 13:4', 0),
      ('Sex', 'Genesis 1:28', 1),
      ('Sex', '1 Corinthians 7:3-5', 2),
      ('Sex', 'Proverbs 5:18-19', 3),
      ('Child Training', 'Ephesians 6:1-3', 0),
      ('Child Training', 'Ephesians 6:4', 1),
      ('Child Training', 'Proverbs 19:18', 2),
      ('Divorce', 'Malachi 2:16', 0),
      ('Divorce', 'Matthew 19:5-6', 1),
      ('Divorce', 'Matthew 19:9', 2),
      ('Divorce', '1 Corinthians 7:15', 3),
      ('Divorce', '1 Corinthians 7:12', 4)
  ),
  inserted_verses AS (
    INSERT INTO public.memorization_recommendations (
      tenant_id,
      reference,
      category_id,
      display_order,
      catalog_source
    )
    SELECT p_tenant_id, vs.reference, ac.id, vs.display_order, 'ibcd'
    FROM verse_seed vs
    INNER JOIN all_categories ac ON ac.name = vs.category_name
    ON CONFLICT (tenant_id, reference) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_verses_added FROM inserted_verses;

  RETURN jsonb_build_object(
    'categories_added', v_categories_added,
    'verses_added', v_verses_added
  );
END;
$memrec$;

CREATE OR REPLACE FUNCTION public.apply_ibcd_memorization_recommendations(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
DECLARE
  v_result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF NOT (public.is_tenant_admin(p_tenant_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized for tenant';
  END IF;

  v_result := public._merge_ibcd_memorization_catalog(p_tenant_id);

  INSERT INTO public.tenant_settings (tenant_id, memorization_ibcd_catalog_applied)
  VALUES (p_tenant_id, true)
  ON CONFLICT (tenant_id) DO UPDATE
  SET memorization_ibcd_catalog_applied = true,
      updated_at = now();

  RETURN v_result || jsonb_build_object('applied', true);
END;
$memrec$;

CREATE OR REPLACE FUNCTION public.remove_ibcd_memorization_recommendations(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
DECLARE
  v_removed_verses integer := 0;
  v_removed_categories integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF NOT (public.is_tenant_admin(p_tenant_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized for tenant';
  END IF;

  DELETE FROM public.memorization_recommendations r
  WHERE r.tenant_id = p_tenant_id
    AND r.catalog_source = 'ibcd';

  GET DIAGNOSTICS v_removed_verses = ROW_COUNT;

  DELETE FROM public.memorization_recommendation_categories c
  WHERE c.tenant_id = p_tenant_id
    AND c.catalog_source = 'ibcd'
    AND NOT EXISTS (
      SELECT 1
      FROM public.memorization_recommendations r
      WHERE r.category_id = c.id
    );

  GET DIAGNOSTICS v_removed_categories = ROW_COUNT;

  UPDATE public.tenant_settings ts
  SET memorization_ibcd_catalog_applied = false,
      updated_at = now()
  WHERE ts.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'removed_verses', v_removed_verses,
    'removed_categories', v_removed_categories
  );
END;
$memrec$;

CREATE OR REPLACE FUNCTION public.get_memorization_ibcd_catalog_status(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $memrec$
DECLARE
  v_applied boolean := false;
  v_category_count integer := 0;
  v_verse_count integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF NOT (
    public.is_tenant_member(p_tenant_id)
    OR public.is_tenant_admin(p_tenant_id)
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized for tenant';
  END IF;

  SELECT coalesce(ts.memorization_ibcd_catalog_applied, false)
  INTO v_applied
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id;

  SELECT count(*)::integer
  INTO v_category_count
  FROM public.memorization_recommendation_categories c
  WHERE c.tenant_id = p_tenant_id
    AND c.catalog_source = 'ibcd';

  SELECT count(*)::integer
  INTO v_verse_count
  FROM public.memorization_recommendations r
  WHERE r.tenant_id = p_tenant_id
    AND r.catalog_source = 'ibcd';

  RETURN jsonb_build_object(
    'applied', coalesce(v_applied, false) OR v_verse_count > 0,
    'ibcd_category_count', coalesce(v_category_count, 0),
    'ibcd_verse_count', coalesce(v_verse_count, 0)
  );
END;
$memrec$;

CREATE OR REPLACE FUNCTION public.seed_ibcd_memorization_recommendations(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
BEGIN
  PERFORM public._merge_ibcd_memorization_catalog(p_tenant_id);

  INSERT INTO public.tenant_settings (tenant_id, memorization_ibcd_catalog_applied)
  VALUES (p_tenant_id, true)
  ON CONFLICT (tenant_id) DO UPDATE
  SET memorization_ibcd_catalog_applied = true,
      updated_at = now();
END;
$memrec$;

COMMENT ON FUNCTION public.apply_ibcd_memorization_recommendations(uuid) IS
  'Merge IBCD counseling memorization catalog into a tenant (tenant admin)';

COMMENT ON FUNCTION public.remove_ibcd_memorization_recommendations(uuid) IS
  'Remove IBCD-tagged memorization recommendations from a tenant (tenant admin)';

COMMENT ON FUNCTION public.get_memorization_ibcd_catalog_status(uuid) IS
  'IBCD catalog apply status and live counts for a tenant';

GRANT EXECUTE ON FUNCTION public.apply_ibcd_memorization_recommendations(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.remove_ibcd_memorization_recommendations(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_memorization_ibcd_catalog_status(uuid)
  TO authenticated, service_role;
