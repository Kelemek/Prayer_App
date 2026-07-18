-- Update seed/clone functions for translation-agnostic memorization_recommendations.
-- Run after 20260718120000_memorization_recommendations_drop_translation.sql.

CREATE OR REPLACE FUNCTION public.seed_ibcd_memorization_recommendations(
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memorization_recommendation_categories
    WHERE tenant_id = p_tenant_id
    LIMIT 1
  ) THEN
    RETURN;
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
    INSERT INTO public.memorization_recommendation_categories (tenant_id, name, display_order)
    SELECT p_tenant_id, cs.name, cs.display_order
    FROM category_seed cs
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id, name
  ),
  all_categories AS (
    SELECT ic.id, ic.name
    FROM inserted_categories ic
    UNION
    SELECT c.id, c.name
    FROM public.memorization_recommendation_categories c
    INNER JOIN category_seed cs ON cs.name = c.name
    WHERE c.tenant_id = p_tenant_id
  ),
  verse_seed (category_name, reference, display_order) AS (
  VALUES
    -- General Principles
    ('General Principles', '2 Timothy 3:16-17', 0),
    ('General Principles', 'Philippians 4:12', 1),
    ('General Principles', 'John 15:5', 2),
    -- Conflict Resolution
    ('Conflict Resolution', 'Matthew 5:9', 0),
    ('Conflict Resolution', 'Proverbs 18:13', 1),
    ('Conflict Resolution', 'Proverbs 18:17', 2),
    ('Conflict Resolution', 'Matthew 7:3-5', 3),
    ('Conflict Resolution', 'Galatians 6:1-2', 4),
    ('Conflict Resolution', 'Matthew 18:15-20', 5),
    ('Conflict Resolution', '1 Corinthians 6:1-8', 6),
    ('Conflict Resolution', 'Romans 12:18', 7),
    -- Anger
    ('Anger', 'Matthew 5:21-22', 0),
    ('Anger', 'James 4:1-6', 1),
    ('Anger', 'Proverbs 25:28', 2),
    -- Revenge
    ('Revenge', 'Romans 12:19-21', 0),
    ('Revenge', 'Matthew 5:43-48', 1),
    -- Abuse
    ('Abuse', 'Hebrews 12:15', 0),
    ('Abuse', 'Genesis 50:19-20', 1),
    -- Communication
    ('Communication', 'James 3:6-12', 0),
    ('Communication', 'Ephesians 4:29', 1),
    ('Communication', 'James 1:19-20', 2),
    ('Communication', 'Philippians 2:3-4', 3),
    ('Communication', 'Proverbs 15:1', 4),
    -- Resisting Temptation
    ('Resisting Temptation', '1 Corinthians 10:13', 0),
    ('Resisting Temptation', 'Genesis 39:7-10', 1),
    -- Lust
    ('Lust', 'Matthew 5:27-30', 0),
    ('Lust', '2 Timothy 2:22', 1),
    ('Lust', 'Philippians 4:8-9', 2),
    -- Fear
    ('Fear', 'Proverbs 29:25', 0),
    ('Fear', 'Jeremiah 17:5-8', 1),
    -- Worry
    ('Worry', 'Matthew 6:25-34', 0),
    ('Worry', 'Philippians 4:6-7', 1),
    -- Depression
    ('Depression', 'Psalms 32', 0),
    ('Depression', 'Philippians 4:11-13', 1),
    -- Addictions
    ('Addictions', 'Isaiah 55:1-2', 0),
    ('Addictions', '2 Timothy 3:4', 1),
    ('Addictions', 'Proverbs 23:29-35', 2),
    -- Facing Trials and Calamity
    ('Facing Trials and Calamity', 'Romans 8:28', 0),
    ('Facing Trials and Calamity', 'James 1:2-4', 1),
    ('Facing Trials and Calamity', 'Romans 8:31-39', 2),
    -- Seeking Forgiveness
    ('Seeking Forgiveness', '1 John 1:8-10', 0),
    ('Seeking Forgiveness', 'Matthew 5:23-24', 1),
    -- Granting Forgiveness
    ('Granting Forgiveness', 'Ephesians 4:32', 0),
    ('Granting Forgiveness', 'Matthew 18:21-35', 1),
    -- Repentance
    ('Repentance', '2 Corinthians 7:9-11', 0),
    ('Repentance', 'Psalms 51', 1),
    -- Presenting the Gospel
    ('Presenting the Gospel', 'Romans 3:20-26', 0),
    ('Presenting the Gospel', 'Isaiah 53:4-6', 1),
    ('Presenting the Gospel', 'Luke 23:39-43', 2),
    ('Presenting the Gospel', 'Ephesians 2:8-9', 3),
    -- Assurance of Salvation
    ('Assurance of Salvation', '1 John 5:1', 0),
    ('Assurance of Salvation', 'John 10:28-29', 1),
    ('Assurance of Salvation', '1 John 2:3-4', 2),
    ('Assurance of Salvation', '1 John 4:8-9', 3),
    -- Sanctification
    ('Sanctification', '1 Corinthians 6:9-11', 0),
    ('Sanctification', 'Romans 6:11', 1),
    ('Sanctification', '2 Corinthians 5:17', 2),
    ('Sanctification', 'Philippians 1:6', 3),
    ('Sanctification', 'Philippians 2:12-13', 4),
    ('Sanctification', 'Ephesians 4:22-24', 5),
    ('Sanctification', 'Titus 2:14', 6),
    -- Church Involvement
    ('Church Involvement', 'Hebrews 10:25', 0),
    ('Church Involvement', 'Hebrews 13:17', 1),
    ('Church Involvement', '1 Peter 4:10-11', 2),
    ('Church Involvement', '1 Corinthians 16:2', 3),
    -- Work and Employment
    ('Work and Employment', 'Exodus 20:9', 0),
    ('Work and Employment', 'Proverbs 6:6-11', 1),
    ('Work and Employment', '2 Thessalonians 3:10', 2),
    ('Work and Employment', 'Ephesians 6:5-9', 3),
    -- Finances
    ('Finances', 'Proverbs 21:5', 0),
    ('Finances', 'James 4:13-17', 1),
    ('Finances', 'Deuteronomy 8:18', 2),
    ('Finances', 'Proverbs 22:7', 3),
    ('Finances', 'Matthew 6:19-21', 4),
    ('Finances', '1 Timothy 6:10', 5),
    ('Finances', '1 Timothy 6:17-19', 6),
    ('Finances', 'Proverbs 3:9', 7),
    ('Finances', 'Matthew 22:17-21', 8),
    -- Decision Making
    ('Decision Making', 'James 1:5', 0),
    ('Decision Making', 'Proverbs 15:22', 1),
    ('Decision Making', 'Deuteronomy 29:29', 2),
    ('Decision Making', 'Proverbs 16:9', 3),
    ('Decision Making', 'Proverbs 3:5-6', 4),
    -- Integrity
    ('Integrity', 'Matthew 5:37', 0),
    ('Integrity', 'Ephesians 4:25', 1),
    -- Marriage
    ('Marriage', 'Genesis 2:18-23', 0),
    ('Marriage', 'Genesis 2:24', 1),
    -- The Role of the Husband
    ('The Role of the Husband', 'Ephesians 5:25-30', 0),
    ('The Role of the Husband', '1 Peter 3:7', 1),
    ('The Role of the Husband', 'John 13:1-17', 2),
    -- The Role of the Wife
    ('The Role of the Wife', 'Ephesians 5:22-24', 0),
    ('The Role of the Wife', '1 Peter 3:1-6', 1),
    -- Sex
    ('Sex', 'Hebrews 13:4', 0),
    ('Sex', 'Genesis 1:28', 1),
    ('Sex', '1 Corinthians 7:3-5', 2),
    ('Sex', 'Proverbs 5:18-19', 3),
    -- Child Training
    ('Child Training', 'Ephesians 6:1-3', 0),
    ('Child Training', 'Ephesians 6:4', 1),
    ('Child Training', 'Proverbs 19:18', 2),
    -- Divorce
    ('Divorce', 'Malachi 2:16', 0),
    ('Divorce', 'Matthew 19:5-6', 1),
    ('Divorce', 'Matthew 19:9', 2),
    ('Divorce', '1 Corinthians 7:15', 3),
    ('Divorce', '1 Corinthians 7:12', 4)
)
  INSERT INTO public.memorization_recommendations (tenant_id, reference, category_id, display_order)
  SELECT p_tenant_id, vs.reference, ac.id, vs.display_order
  FROM verse_seed vs
  INNER JOIN all_categories ac ON ac.name = vs.category_name
  ON CONFLICT (tenant_id, reference) DO NOTHING;
END;
$memrec$;

CREATE OR REPLACE FUNCTION public.seed_tenant_memorization_recommendations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $memrec$
DECLARE
  def_id uuid;
BEGIN
  SELECT id INTO def_id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1;
  IF def_id IS NULL OR NEW.id = def_id THEN
    -- New default tenant (or missing): seed IBCD catalog directly.
    PERFORM public.seed_ibcd_memorization_recommendations(NEW.id);
    RETURN NEW;
  END IF;

  -- Prefer cloning curated content from default-tenant when present.
  IF EXISTS (
    SELECT 1 FROM public.memorization_recommendation_categories WHERE tenant_id = def_id LIMIT 1
  ) THEN
    WITH cat_map AS (
      INSERT INTO public.memorization_recommendation_categories (tenant_id, name, display_order)
      SELECT NEW.id, src.name, src.display_order
      FROM public.memorization_recommendation_categories src
      WHERE src.tenant_id = def_id
      ON CONFLICT (tenant_id, name) DO NOTHING
      RETURNING id, name
    ),
    all_cats AS (
      SELECT cm.id, cm.name FROM cat_map cm
      UNION
      SELECT c.id, c.name
      FROM public.memorization_recommendation_categories c
      WHERE c.tenant_id = NEW.id
    )
    INSERT INTO public.memorization_recommendations (tenant_id, reference, category_id, display_order)
    SELECT
      NEW.id,
      src.reference,
      ac.id,
      src.display_order
    FROM public.memorization_recommendations src
    INNER JOIN public.memorization_recommendation_categories src_cat
      ON src_cat.id = src.category_id
    INNER JOIN all_cats ac ON ac.name = src_cat.name
    WHERE src.tenant_id = def_id
    ON CONFLICT (tenant_id, reference) DO NOTHING;
  ELSE
    PERFORM public.seed_ibcd_memorization_recommendations(NEW.id);
  END IF;

  RETURN NEW;
END;
$memrec$;
