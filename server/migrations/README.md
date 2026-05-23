Database migrations

This project currently ships a `database.sql` schema file used for initial development.

Recommended workflow before production:

- Use a migration tool (knex, umzug, flyway, or similar) to manage schema changes.
- Example with `knex`:
  - Install knex and a client: `npm install --save-dev knex pg` (or `mysql2`)
  - Initialize: `npx knex init`
  - Create migrations: `npx knex migrate:make create_users_table`

Temporary import (development only): set `IMPORT_SCHEMA=true` in your `.env` and ensure `NODE_ENV` is not `production`.
