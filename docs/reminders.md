# Reminder pushes

The `reminders` Edge Function scans live `push_subscriptions` with the service role and sends Web Push. It is not deployed from this repository. Do not put key values, `.env` files, or the service role in git.

## Environment

| Name | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | Expo web build | Browser `PushManager.subscribe` application server key |
| `VAPID_PUBLIC_KEY` | Edge Function | Same public key, base64url uncompressed P-256 |
| `VAPID_PRIVATE_KEY` | Edge Function | Base64url raw 32-byte P-256 private key |
| `VAPID_SUBJECT` | Edge Function | `mailto:` or `https:` contact on the VAPID JWT |
| `REMINDERS_CRON_SECRET` | Edge Function. The scheduled command reads the same value from Vault (`reminders_cron_secret`) | Shared secret. The request header is `x-reminders-cron-secret` |
| `SUPABASE_URL` | Injected by Supabase | Project URL. Not set in this repo |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase | Service role. Not set in this repo |

`verify_jwt` is false for this function. The header above is the only gate. A missing or wrong secret does not scan. The JSON body is ignored, including any `user_id`.

Generate a key pair locally with whatever Web Push tool you already trust. Paste the public key into the Expo env and both keys into the function env. Do not commit the output.

## When a push is sent

A row is due when it is not soft-deleted and its own flag is true (`training_enabled` or `month_end_enabled`). Training also needs today's ISO weekday (Monday 1 through Sunday 7) in `training_days`, and the civil clock in `tz` at or after `training_time` (default 08:00). Month-end needs the last civil day of that month in `tz`, at or after `month_end_time` (default 21:30).

The function then runs the equivalent of:

```sql
insert into public.reminder_deliveries (subscription_id, kind, local_day, sent_at)
values ($1, $2, $3, now())
on conflict (subscription_id, kind, local_day) do nothing
returning subscription_id;
```

It sends only when that insert returns a row. A second run the same local day inserts nothing and sends nothing. `404` and `410` from the push service soft-delete the subscription (`deleted_at`) and stop the rest of that row.

Logs are a fixed JSON shape (`event`, `kind`, `status`, counts). They do not include the endpoint, `p256dh`, `auth`, the VAPID private key, or the service role.

## Delivery log

`reminder_deliveries` is in the journal timeline migration. This change does not add or edit a migration. The table has a uuid primary key, a unique key on `(subscription_id, kind, local_day)`, `kind` limited to `training` or `month_end`, and `on delete cascade` from `push_subscriptions`. RLS is on. `anon` and `authenticated` have no privileges, so the function writes it with the service role.

A soft delete sets `deleted_at` and leaves the delivery rows in place. The sender skips that subscription. A later subscribe uses a new id, because a soft-deleted row cannot be updated.

Authenticated clients keep `select`, `insert`, and `update` on `push_subscriptions`. There is no `DELETE` grant. A revoked permission and a dead push endpoint are soft deletes.

The asset dashboard route `/assets` is not in this branch. The month-end notification and the 今日 banner both open `/assets?updateBalances=1`.

## Schedule

This is not a migration in this repo. Do not store the service role, the cron secret, or the project URL in `cron.job`.

创建这个定时任务属于托管库的敏感改动，需要四人全审并由 Yifeng 点头，由 Grok Ultra 通过官方连接器执行；不要手动在托管库执行。

An operator creates the Vault secrets once. Both values below are placeholders.

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'reminders_project_url');
select vault.create_secret('REPLACE_WITH_CRON_SECRET', 'reminders_cron_secret');
```

The scheduled command only reads those names:

```sql
select cron.schedule(
  'viastela-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_project_url') || '/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminders-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```
