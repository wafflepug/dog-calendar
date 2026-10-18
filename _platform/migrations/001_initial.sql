-- Commercial foundation schema. Apply as a migration owner, never as palz_app.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'palz_app') THEN
    CREATE ROLE palz_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE palz_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  created_by text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  timezone text NOT NULL, capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 200),
  plan text NOT NULL DEFAULT 'free' CHECK (plan = 'free'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  CHECK (slug NOT IN ('app','auth','www','admin','support','api','status'))
);
CREATE TABLE IF NOT EXISTS members (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id text NOT NULL, role text NOT NULL CHECK (role IN ('owner','staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (business_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_business ON members(business_id) WHERE role='owner';
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), email text, phone text,
  UNIQUE (business_id,id)
);
CREATE TABLE IF NOT EXISTS dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number bigint NOT NULL, name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  breed text NOT NULL DEFAULT '' CHECK(length(trim(breed)) <= 120), owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(business_id,id), UNIQUE(business_id,number),
  FOREIGN KEY (business_id,owner_id) REFERENCES owners(business_id,id)
);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  start_date date NOT NULL, end_date date NOT NULL, status text NOT NULL DEFAULT 'confirmed' CHECK(status='confirmed'),
  mutation_id text NOT NULL, intent_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(end_date >= start_date),
  CHECK(start_date >= DATE '2000-01-01' AND end_date <= DATE '2100-12-31' AND end_date-start_date < 366),
  UNIQUE(business_id,id), UNIQUE(business_id,mutation_id)
);
CREATE TABLE IF NOT EXISTS booking_dogs (
  business_id uuid NOT NULL, booking_id uuid NOT NULL, dog_id uuid NOT NULL,
  PRIMARY KEY(business_id,booking_id,dog_id),
  FOREIGN KEY(business_id,booking_id) REFERENCES bookings(business_id,id) ON DELETE CASCADE,
  FOREIGN KEY(business_id,dog_id) REFERENCES dogs(business_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  accepted_at timestamptz, accepted_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL, event_type text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trusted helper functions read membership without recursively evaluating its RLS policy.
-- They are owned by the migration owner and expose only boolean membership/role answers.
CREATE OR REPLACE FUNCTION app_member(p_business uuid, p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p_user IS NOT DISTINCT FROM current_setting('app.user_id',true) AND
    EXISTS (SELECT 1 FROM public.members m WHERE m.business_id=p_business AND m.user_id=p_user AND m.status='active')
$$;
CREATE OR REPLACE FUNCTION app_owner(p_business uuid, p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p_user IS NOT DISTINCT FROM current_setting('app.user_id',true) AND
    EXISTS (SELECT 1 FROM public.members m WHERE m.business_id=p_business AND m.user_id=p_user AND m.status='active' AND m.role='owner')
$$;
CREATE OR REPLACE FUNCTION app_role(p_business uuid, p_user text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT m.role FROM public.members m WHERE p_user IS NOT DISTINCT FROM current_setting('app.user_id',true) AND m.business_id=p_business AND m.user_id=p_user AND m.status='active'
$$;
CREATE OR REPLACE FUNCTION app_invite_email(p_business uuid, p_user text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT (SELECT i.email FROM public.invites i WHERE i.business_id=p_business AND i.accepted_by=p_user AND i.accepted_at IS NOT NULL ORDER BY i.accepted_at DESC,i.id DESC LIMIT 1)
  WHERE p_business::text=current_setting('app.business_id',true) AND app_owner(p_business,current_setting('app.user_id',true))
$$;
CREATE OR REPLACE FUNCTION lock_business_for_booking(p_business uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT app_member(p_business,current_setting('app.user_id',true)) THEN RAISE EXCEPTION 'business not found' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.businesses WHERE id=p_business FOR UPDATE;
END $$;
REVOKE ALL ON FUNCTION app_member(uuid,text), app_owner(uuid,text), app_role(uuid,text), app_invite_email(uuid,text), lock_business_for_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_member(uuid,text), app_owner(uuid,text), app_role(uuid,text), app_invite_email(uuid,text), lock_business_for_booking(uuid) TO palz_app;

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
-- Deliberately do not FORCE RLS: the migration owner owns these tables so the
-- fixed-search_path SECURITY DEFINER helpers below can bootstrap membership,
-- accept invites, and apply serialized guards. palz_app is never the owner and
-- remains subject to every policy and the narrower table grants below.
CREATE POLICY business_tenant ON businesses USING (app_member(id,current_setting('app.user_id',true)) AND (coalesce(current_setting('app.business_id',true),'')='' OR id::text=current_setting('app.business_id',true))) WITH CHECK (app_member(id,current_setting('app.user_id',true)) AND (coalesce(current_setting('app.business_id',true),'')='' OR id::text=current_setting('app.business_id',true)));
CREATE POLICY member_owner_select ON members FOR SELECT USING (
  (user_id=current_setting('app.user_id',true) AND (coalesce(current_setting('app.business_id',true),'')='' OR business_id::text=current_setting('app.business_id',true)))
  OR (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true))
);
CREATE POLICY member_owner_update ON members FOR UPDATE USING (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY owner_tenant ON owners USING (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY dog_tenant ON dogs USING (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY booking_tenant ON bookings USING (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY booking_dog_tenant ON booking_dogs USING (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY invite_tenant ON invites USING (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true)) WITH CHECK (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY audit_owner_select ON audit_events FOR SELECT USING (app_owner(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));
CREATE POLICY audit_member_insert ON audit_events FOR INSERT WITH CHECK (app_member(business_id,current_setting('app.user_id',true)) AND business_id::text=current_setting('app.business_id',true));

-- Trusted bootstrap/acceptance functions run as migration owner so the first owner and
-- invitee can be created atomically despite tenant RLS. They expose no table access.
CREATE OR REPLACE FUNCTION bootstrap_create_business(p_user text,p_name text,p_slug text,p_timezone text,p_capacity integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b uuid;
BEGIN
  IF p_user IS NULL OR p_user='' OR p_user IS DISTINCT FROM current_setting('app.user_id',true) OR p_capacity NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid business'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user,0));
  IF (SELECT count(*) FROM members WHERE user_id=p_user AND role='owner' AND status='active') >= 3 THEN RAISE EXCEPTION 'business limit' USING ERRCODE='23514'; END IF;
  INSERT INTO businesses(name,slug,timezone,capacity,created_by) VALUES(p_name,p_slug,p_timezone,p_capacity,p_user) RETURNING id INTO b;
  INSERT INTO members(business_id,user_id,role) VALUES(b,p_user,'owner');
  INSERT INTO audit_events(business_id,actor_user_id,event_type) VALUES(b,p_user,'business.created');
  RETURN b;
END $$;
CREATE OR REPLACE FUNCTION accept_invite(p_user text,p_email text,p_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b uuid;
BEGIN
  IF p_user IS NULL OR p_user='' OR p_user IS DISTINCT FROM current_setting('app.user_id',true) THEN RAISE EXCEPTION 'invalid invitation user' USING ERRCODE='42501'; END IF;
  UPDATE invites SET accepted_at=now(),accepted_by=p_user
   WHERE token_hash=p_hash AND lower(email)=lower(p_email) AND accepted_at IS NULL AND expires_at>now()
   RETURNING business_id INTO b;
  IF b IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM businesses WHERE id=b FOR UPDATE;
  IF (SELECT count(*) FROM members WHERE business_id=b AND status='active') >= 3 THEN
    RAISE EXCEPTION 'member limit' USING ERRCODE='23514';
  END IF;
  INSERT INTO members(business_id,user_id,role,status) VALUES(b,p_user,'staff','active') ON CONFLICT(business_id,user_id) DO UPDATE SET status='active';
  INSERT INTO audit_events(business_id,actor_user_id,event_type) VALUES(b,p_user,'member.invite.accepted');
  RETURN b;
END $$;
REVOKE ALL ON FUNCTION bootstrap_create_business(text,text,text,text,integer), accept_invite(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_create_business(text,text,text,text,integer), accept_invite(text,text,text) TO palz_app;

CREATE OR REPLACE FUNCTION enforce_dog_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM businesses WHERE id=NEW.business_id FOR UPDATE;
  IF (SELECT count(*) FROM dogs WHERE business_id=NEW.business_id) >= 50 THEN RAISE EXCEPTION 'dog limit' USING ERRCODE='23514'; END IF;
  NEW.number := (SELECT coalesce(max(number),0)+1 FROM dogs WHERE business_id=NEW.business_id);
  RETURN NEW;
END $$;
CREATE TRIGGER dog_limit_guard BEFORE INSERT ON dogs FOR EACH ROW EXECUTE FUNCTION enforce_dog_limit();

CREATE OR REPLACE FUNCTION enforce_member_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NEW.status='active' AND (TG_OP='INSERT' OR OLD.status<>'active') THEN
    PERFORM 1 FROM businesses WHERE id=NEW.business_id FOR UPDATE;
    IF (SELECT count(*) FROM members WHERE business_id=NEW.business_id AND status='active') >= 3 THEN RAISE EXCEPTION 'member limit' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER member_limit_guard BEFORE INSERT OR UPDATE OF status ON members FOR EACH ROW EXECUTE FUNCTION enforce_member_limit();

CREATE OR REPLACE FUNCTION protect_member_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.business_id<>OLD.business_id OR NEW.user_id<>OLD.user_id OR NEW.role<>OLD.role) THEN
    RAISE EXCEPTION 'member identity is immutable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' AND OLD.role='owner' THEN RAISE EXCEPTION 'business owner cannot be removed' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND OLD.role='owner' AND NEW.status<>OLD.status THEN RAISE EXCEPTION 'business owner cannot be disabled' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER member_identity_guard BEFORE UPDATE OR DELETE ON members FOR EACH ROW EXECUTE FUNCTION protect_member_identity();

CREATE OR REPLACE FUNCTION protect_business_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NEW.id<>OLD.id OR NEW.created_by<>OLD.created_by THEN RAISE EXCEPTION 'business identity is immutable' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER business_identity_guard BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION protect_business_identity();

CREATE OR REPLACE FUNCTION check_booking_overlap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s date; e date; cap integer;
BEGIN
  SELECT start_date,end_date INTO s,e FROM bookings WHERE id=NEW.booking_id AND business_id=NEW.business_id;
  SELECT capacity INTO cap FROM businesses WHERE id=NEW.business_id FOR UPDATE;
  IF cap IS NULL THEN RAISE EXCEPTION 'business missing'; END IF;
  IF (SELECT count(*) FROM booking_dogs WHERE booking_id=NEW.booking_id AND business_id=NEW.business_id) >= 8 THEN
    RAISE EXCEPTION 'booking dog limit' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM dogs WHERE id=NEW.dog_id AND business_id=NEW.business_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM booking_dogs bd JOIN bookings b ON b.id=bd.booking_id AND b.business_id=bd.business_id
    WHERE bd.business_id=NEW.business_id AND bd.dog_id=NEW.dog_id AND b.status='confirmed'
      AND daterange(b.start_date,b.end_date,'[]') && daterange(s,e,'[]'))
  THEN RAISE EXCEPTION 'booking overlap' USING ERRCODE='23P01'; END IF;
  IF EXISTS (
    SELECT 1 FROM generate_series(s,e,interval '1 day') AS days(day)
    WHERE (SELECT count(*) FROM booking_dogs bd JOIN bookings b ON b.id=bd.booking_id AND b.business_id=bd.business_id
      WHERE bd.business_id=NEW.business_id AND b.status='confirmed' AND b.start_date<=day::date AND b.end_date>=day::date) >= cap
  ) THEN RAISE EXCEPTION 'booking capacity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_overlap_guard BEFORE INSERT ON booking_dogs FOR EACH ROW EXECUTE FUNCTION check_booking_overlap();

CREATE OR REPLACE FUNCTION enforce_audit_actor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NEW.actor_user_id IS DISTINCT FROM current_setting('app.user_id',true) THEN
    RAISE EXCEPTION 'audit actor must match authenticated user' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_actor_guard BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION enforce_audit_actor();

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO palz_app;
GRANT SELECT ON businesses,members,owners,dogs,bookings,booking_dogs,audit_events TO palz_app;
GRANT UPDATE(status) ON members TO palz_app;
GRANT INSERT ON owners,dogs,bookings,booking_dogs,invites,audit_events TO palz_app;
