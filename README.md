# Marine OS

Shared operating system for the sister companies **Xpert Marine** and **Eliche Radice**.
Both companies share one Supabase Postgres database, and every company-owned record is tagged with its company.

## Getting started

```bash
npm install
cp .env.example .env      # fill in the Supabase connection strings and AUTH_SECRET
npm run db:setup          # applies migrations and creates the demo accounts
npm run dev               # http://localhost:3000 (development: slower, reloads on code changes)
npm run prod              # build + start the fast production version (use this for daily work)
```

## Keyboard shortcuts

Press `?` anywhere in a company workspace to see the list.

| Key | Action |
|---|---|
| F2 / F9 | New product / New service (opens a pop-up on Stock / Services) |
| F3 / F4 | New purchase / Suppliers |
| Shift+F3 | Purchase orders (New purchase order is a button there) |
| F6 / F10 / F7 / F8 | Stock / Services / Purchase history / Dashboard |
| Shift+F2 | New offer (also the button on the Offers page) |
| Shift+F6 / Shift+F7 / Shift+F4 | Offers / Invoices / Customers |
| Ctrl+S | Save the current form |
| Ctrl+P | Open the PDF (on an offer or invoice) |
| Ctrl+Shift+S | Save the product and start a new one |
| / | Jump to the search or scan box |

Shortcuts and the sidebar are both defined in `src/lib/navigation.ts`.

## Purchase orders

- Numbered per company and year: `XM-PO-2026-0001`. Draft → Sent → Received (or Cancelled), with a PDF for the supplier.
- **Receive goods** opens the purchase screen pre-filled from the order; saving adds the stock and marks the order received.
- New products can be created from the order (and purchase) lines in a pop-up without losing the form.

## Offers (quotations)

- Numbered per company and year: `XM-OF-2026-0001`, `ER-OF-2026-0001`.
- PDF layout lives in `src/lib/pdf/offer-pdf.tsx`; letterhead details come from **Company details**.
- A sample is in `docs/sample-offer-xpert-marine.pdf` (example data).

## Database

- Hosted on Supabase (Sydney region). Schema changes go through Prisma migrations in `prisma/migrations`.
- To change the schema, edit `prisma/schema.prisma` and then run `npm run db:migrate`.
- Row-level security is on for every table, which keeps Supabase's public REST API closed.
  Add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to the migration for each new table.

## Roles

| Role | Companies | Sections |
|---|---|---|
| Admin | Both (picks one after login, can switch) | Everything |
| Manager | Own company only | Everything in that company, including Team & roles |
| Stock worker | Own company | Dashboard, Inventory, Tasks |
| Regular worker | Own company | Dashboard, Tasks |
| Marketing manager | Own company | Dashboard, Marketing, Tasks |
| Cashier | Own company | Dashboard, Sales / POS, Tasks |
| Accountant | Own company | Dashboard, Accounting, Sales / POS, Tasks |

You can change these in `src/lib/permissions.ts`, which is the only place they are defined.

Admins and managers create accounts and assign roles from **Team & roles**.
Managers can assign every role except Manager and Admin.

## Demo accounts

All demo accounts use the password `Marine2026!`.

| Account | Email |
|---|---|
| Xpert Marine: manager, stock, worker, marketing, cashier, accountant | xm.manager@marineos.local, xm.stock@…, xm.worker@…, xm.marketing@…, xm.cashier@…, xm.accountant@… |
| Eliche Radice: same set | er.manager@marineos.local, er.stock@…, etc. |

There is no demo admin. On a fresh database, create one with
`SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:setup`.

Change these passwords (or delete the accounts) before real use.
