# lnsp-mediator scripts

Small operator scripts that talk to a running `lnsp-mediator` over its HTTP API.

## Requirements

- `curl` and `jq` on `$PATH`
- A reachable `lnsp-mediator` — by default `http://localhost:3000`, overridable via
  a third positional arg or the `LNSP_MEDIATOR_URL` env var.

## `set-subscription.sh`

Repoint a subscription at a new target URL. Deletes the subscription whose
`targetAddress` matches `OLD_URL` (if any) and then creates one with `NEW_URL`.

```sh
./set-subscription.sh <OLD_URL> <NEW_URL> [BASE_URL]
```

Examples:

```sh
# Against a local dev mediator
./set-subscription.sh http://old.example/cb http://new.example/cb

# Against a staging host
./set-subscription.sh http://old.example/cb http://new.example/cb https://staging.example

# Using LNSP_MEDIATOR_URL
export LNSP_MEDIATOR_URL=https://staging.example
./set-subscription.sh http://old.example/cb http://new.example/cb
```

The script uses only the modern JSON CRUD endpoints (`GET /subscription`,
`DELETE /subscription/:id`, `POST /subscription`), not the legacy SOAP path.
