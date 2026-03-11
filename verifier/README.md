# Mercenary Contract Verifier

Polls Sui testnet for EVE Frontier world events and auto-settles matching contracts.

## Setup

```bash
cd verifier
npm install
```

## Run

Export the deployer's private key (the address that holds the VerifierCap):

```bash
# Get your private key from Sui CLI:
sui keytool export --key-identity <your-address>

# Set it and run:
export VERIFIER_PRIVATE_KEY="<your-private-key>"
node --experimental-strip-types verifier.ts
```

## What it does

1. Fetches all ACTIVE contracts from chain (status=1)
2. Polls world events every 8 seconds:
   - `KillmailCreatedEvent` → verifies DESTROY_TARGET missions
   - `StatusChangedEvent` → verifies DEFEND_BASE missions  
   - `ItemDepositedEvent` → verifies DELIVER_CARGO missions
3. When an event matches a contract's solar system, calls `verify_and_settle`
4. Funds are paid to executor automatically — no human intervention

## Matching logic

| Mission Type | World Event | Match Condition |
|---|---|---|
| DESTROY_TARGET | KillmailCreatedEvent | `solar_system_id` matches |
| DEFEND_BASE | StatusChangedEvent | `solar_system_id` + status ONLINE |
| DELIVER_CARGO | ItemDepositedEvent | `solar_system_id` matches |
