#!/bin/sh
set -eu

# This script is run by the official PostgreSQL image on first initialization.
# Re-run it with the owner environment after pg_restore --no-owner --no-acl so
# restored objects receive the same grants. It never prints credential values.

if [ "${POSTGRES_DB:-}" != "flowpack" ] || [ "${POSTGRES_USER:-}" != "flowpack_owner" ]; then
  echo "FlowPack PostgreSQL owner boundary is invalid" >&2
  exit 1
fi

validate_secret() {
  value=${1:-}
  if [ "${#value}" -lt 32 ]; then
    echo "FlowPack PostgreSQL runtime credential is invalid" >&2
    exit 1
  fi
  case "$value" in
    *[!A-Za-z0-9._~-]*)
      echo "FlowPack PostgreSQL runtime credential is invalid" >&2
      exit 1
      ;;
  esac
}

validate_secret "${FLOWPACK_APP_RW_DB_PASSWORD:-}"
validate_secret "${FLOWPACK_APP_RO_DB_PASSWORD:-}"

{
  # Feed psql variables over stdin so credentials are not exposed in argv.
  printf "\\set rw_password '%s'\n" "$FLOWPACK_APP_RW_DB_PASSWORD"
  printf "\\set ro_password '%s'\n" "$FLOWPACK_APP_RO_DB_PASSWORD"
  cat <<'SQL'
SELECT format(
  'CREATE ROLE flowpack_app_rw LOGIN PASSWORD %L NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'rw_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowpack_app_rw')
\gexec

SELECT format(
  'CREATE ROLE flowpack_app_ro LOGIN PASSWORD %L NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'ro_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowpack_app_ro')
\gexec

SELECT format('ALTER ROLE flowpack_app_rw PASSWORD %L', :'rw_password')
\gexec
SELECT format('ALTER ROLE flowpack_app_ro PASSWORD %L', :'ro_password')
\gexec

ALTER ROLE flowpack_app_rw WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE flowpack_app_ro WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE flowpack_app_rw SET default_transaction_read_only = off;
ALTER ROLE flowpack_app_ro SET default_transaction_read_only = on;
ALTER ROLE flowpack_app_rw SET search_path = public;
ALTER ROLE flowpack_app_ro SET search_path = public;

REVOKE ALL ON DATABASE flowpack FROM PUBLIC;
GRANT CONNECT ON DATABASE flowpack TO flowpack_app_rw, flowpack_app_ro;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM flowpack_app_rw, flowpack_app_ro;
GRANT USAGE ON SCHEMA public TO flowpack_app_rw, flowpack_app_ro;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM flowpack_app_rw, flowpack_app_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM flowpack_app_rw, flowpack_app_ro;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, flowpack_app_rw, flowpack_app_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flowpack_app_rw;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO flowpack_app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO flowpack_app_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO flowpack_app_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flowpack_app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO flowpack_app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO flowpack_app_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE flowpack_owner IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO flowpack_app_ro;
SQL
} | psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB"
