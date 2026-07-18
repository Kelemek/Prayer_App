-- IBCD memorization catalog reference tables (single source of truth for seed data).

CREATE TABLE IF NOT EXISTS public.ibcd_memorization_catalog_categories (
  name text PRIMARY KEY,
  display_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ibcd_memorization_catalog_verses (
  category_name text NOT NULL
    REFERENCES public.ibcd_memorization_catalog_categories (name) ON DELETE CASCADE,
  reference text NOT NULL,
  display_order integer NOT NULL,
  PRIMARY KEY (category_name, reference)
);

ALTER TABLE public.ibcd_memorization_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibcd_memorization_catalog_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY ibcd_catalog_categories_read ON public.ibcd_memorization_catalog_categories
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY ibcd_catalog_verses_read ON public.ibcd_memorization_catalog_verses
  FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON public.ibcd_memorization_catalog_categories TO authenticated, anon;
GRANT SELECT ON public.ibcd_memorization_catalog_verses TO authenticated, anon;
GRANT ALL ON public.ibcd_memorization_catalog_categories TO service_role;
GRANT ALL ON public.ibcd_memorization_catalog_verses TO service_role;

INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Abuse', 10) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Addictions', 20) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Anger', 30) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Assurance of Salvation', 40) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Child Training', 50) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Church Involvement', 60) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Communication', 70) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Conflict Resolution', 80) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Decision Making', 90) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Depression', 100) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Divorce', 110) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Facing Trials and Calamity', 120) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Fear', 130) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Finances', 140) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('General Principles', 150) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Granting Forgiveness', 160) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Integrity', 170) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Lust', 180) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Marriage', 190) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Presenting the Gospel', 200) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Repentance', 210) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Resisting Temptation', 220) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Revenge', 230) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Sanctification', 240) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Seeking Forgiveness', 250) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Sex', 260) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('The Role of the Husband', 270) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('The Role of the Wife', 280) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Work and Employment', 290) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_categories (name, display_order) VALUES ('Worry', 300) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('General Principles', '2 Timothy 3:16-17', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('General Principles', 'Philippians 4:12', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('General Principles', 'John 15:5', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Matthew 5:9', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Proverbs 18:13', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Proverbs 18:17', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Matthew 7:3-5', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Galatians 6:1-2', 4) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Matthew 18:15-20', 5) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', '1 Corinthians 6:1-8', 6) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Conflict Resolution', 'Romans 12:18', 7) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Anger', 'Matthew 5:21-22', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Anger', 'James 4:1-6', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Anger', 'Proverbs 25:28', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Revenge', 'Romans 12:19-21', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Revenge', 'Matthew 5:43-48', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Abuse', 'Hebrews 12:15', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Abuse', 'Genesis 50:19-20', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Communication', 'James 3:6-12', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Communication', 'Ephesians 4:29', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Communication', 'James 1:19-20', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Communication', 'Philippians 2:3-4', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Communication', 'Proverbs 15:1', 4) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Resisting Temptation', '1 Corinthians 10:13', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Resisting Temptation', 'Genesis 39:7-10', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Lust', 'Matthew 5:27-30', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Lust', '2 Timothy 2:22', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Lust', 'Philippians 4:8-9', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Fear', 'Proverbs 29:25', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Fear', 'Jeremiah 17:5-8', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Worry', 'Matthew 6:25-34', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Worry', 'Philippians 4:6-7', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Depression', 'Psalms 32', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Depression', 'Philippians 4:11-13', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Addictions', 'Isaiah 55:1-2', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Addictions', '2 Timothy 3:4', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Addictions', 'Proverbs 23:29-35', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Facing Trials and Calamity', 'Romans 8:28', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Facing Trials and Calamity', 'James 1:2-4', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Facing Trials and Calamity', 'Romans 8:31-39', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Seeking Forgiveness', '1 John 1:8-10', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Seeking Forgiveness', 'Matthew 5:23-24', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Granting Forgiveness', 'Ephesians 4:32', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Granting Forgiveness', 'Matthew 18:21-35', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Repentance', '2 Corinthians 7:9-11', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Repentance', 'Psalms 51', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Presenting the Gospel', 'Romans 3:20-26', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Presenting the Gospel', 'Isaiah 53:4-6', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Presenting the Gospel', 'Luke 23:39-43', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Presenting the Gospel', 'Ephesians 2:8-9', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Assurance of Salvation', '1 John 5:1', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Assurance of Salvation', 'John 10:28-29', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Assurance of Salvation', '1 John 2:3-4', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Assurance of Salvation', '1 John 4:8-9', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', '1 Corinthians 6:9-11', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', 'Romans 6:11', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', '2 Corinthians 5:17', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', 'Philippians 1:6', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', 'Philippians 2:12-13', 4) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', 'Ephesians 4:22-24', 5) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sanctification', 'Titus 2:14', 6) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Church Involvement', 'Hebrews 10:25', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Church Involvement', 'Hebrews 13:17', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Church Involvement', '1 Peter 4:10-11', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Church Involvement', '1 Corinthians 16:2', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Work and Employment', 'Exodus 20:9', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Work and Employment', 'Proverbs 6:6-11', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Work and Employment', '2 Thessalonians 3:10', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Work and Employment', 'Ephesians 6:5-9', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Proverbs 21:5', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'James 4:13-17', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Deuteronomy 8:18', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Proverbs 22:7', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Matthew 6:19-21', 4) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', '1 Timothy 6:10', 5) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', '1 Timothy 6:17-19', 6) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Proverbs 3:9', 7) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Finances', 'Matthew 22:17-21', 8) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Decision Making', 'James 1:5', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Decision Making', 'Proverbs 15:22', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Decision Making', 'Deuteronomy 29:29', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Decision Making', 'Proverbs 16:9', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Decision Making', 'Proverbs 3:5-6', 4) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Integrity', 'Matthew 5:37', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Integrity', 'Ephesians 4:25', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Marriage', 'Genesis 2:18-23', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Marriage', 'Genesis 2:24', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('The Role of the Husband', 'Ephesians 5:25-30', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('The Role of the Husband', '1 Peter 3:7', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('The Role of the Husband', 'John 13:1-17', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('The Role of the Wife', 'Ephesians 5:22-24', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('The Role of the Wife', '1 Peter 3:1-6', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sex', 'Hebrews 13:4', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sex', 'Genesis 1:28', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sex', '1 Corinthians 7:3-5', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Sex', 'Proverbs 5:18-19', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Child Training', 'Ephesians 6:1-3', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Child Training', 'Ephesians 6:4', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Child Training', 'Proverbs 19:18', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Divorce', 'Malachi 2:16', 0) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Divorce', 'Matthew 19:5-6', 1) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Divorce', 'Matthew 19:9', 2) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Divorce', '1 Corinthians 7:15', 3) ON CONFLICT (category_name, reference) DO NOTHING;
INSERT INTO public.ibcd_memorization_catalog_verses (category_name, reference, display_order) VALUES ('Divorce', '1 Corinthians 7:12', 4) ON CONFLICT (category_name, reference) DO NOTHING;

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

  WITH inserted_categories AS (
    INSERT INTO public.memorization_recommendation_categories (
      tenant_id,
      name,
      display_order,
      catalog_source
    )
    SELECT p_tenant_id, c.name, c.display_order, 'ibcd'
    FROM public.ibcd_memorization_catalog_categories c
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_categories_added FROM inserted_categories;

  WITH all_categories AS (
    SELECT mc.id, mc.name
    FROM public.memorization_recommendation_categories mc
    INNER JOIN public.ibcd_memorization_catalog_categories ic ON ic.name = mc.name
    WHERE mc.tenant_id = p_tenant_id
  ),
  inserted_verses AS (
    INSERT INTO public.memorization_recommendations (
      tenant_id,
      reference,
      category_id,
      display_order,
      catalog_source
    )
    SELECT p_tenant_id, v.reference, ac.id, v.display_order, 'ibcd'
    FROM public.ibcd_memorization_catalog_verses v
    INNER JOIN all_categories ac ON ac.name = v.category_name
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

CREATE OR REPLACE FUNCTION public.get_memorization_ibcd_catalog_status(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
    'applied', coalesce(v_applied, false),
    'ibcd_category_count', coalesce(v_category_count, 0),
    'ibcd_verse_count', coalesce(v_verse_count, 0)
  );
END;
$memrec$;

-- seed_ibcd is internal; only service_role may invoke it directly.
REVOKE ALL ON FUNCTION public.seed_ibcd_memorization_recommendations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_ibcd_memorization_recommendations(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_ibcd_memorization_recommendations(uuid) TO service_role;

