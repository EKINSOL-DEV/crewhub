# Device Identity Implementation for OpenClaw Gateway

## Overview

CrewHub now implements **device identity** for OpenClaw Gateway connections, following the proper OpenClaw device pairing protocol. This eliminates "missing scope: operator.read" errors caused by connecting as a CLI client without device credentials.

## Architecture

### Components

1. **DeviceIdentityManager** (`app/services/connections/device_identity.py`)
   - Generates Ed25519 keypairs
   - Manages device pairing lifecycle
   - Persists device tokens in database

2. **OpenClawConnection** (updated)
   - Uses device identity for authentication
   - Performs automatic pairing on first connect
   - Falls back to token auth if device identity disabled

3. **API Endpoints** (`app/routes/connections.py`, `app/routes/onboarding.py`)
   - `GET /connections/{id}/device-pairing-status` - Check pairing status
   - `POST /connections/{id}/pair-device` - Manually trigger pairing
   - `POST /onboarding/ensure-device-pairing` - Pair all connections

## How It Works

### First Connection (Pairing Flow)

1. **Generate Device Identity**
   - Create Ed25519 keypair (public/private)
   - Assign unique device ID
   - Store in database

2. **Connect to Gateway**
   - Establish WebSocket connection
   - Receive connect.challenge event

3. **Request Pairing**
   - Send `devices.pair` request with:
     - Device ID
     - Device name (e.g., "CrewHub-MyGateway")
     - Public key (PEM format)
     - Metadata (application, version)

4. **Receive Device Token**
   - Gateway validates and approves pairing
   - Returns device token
   - Token stored in database

5. **Authenticate with Token**
   - Use device token for all subsequent connections
   - Gateway recognizes device and grants scopes

### Subsequent Connections

- Device identity loaded from database
- Device token used for authentication
- No re-pairing needed (unless token revoked)

## Database Schema

```sql
CREATE TABLE device_identities (
    device_id TEXT PRIMARY KEY,
    connection_id TEXT,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    private_key_pem TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    device_token TEXT,
    paired_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
)
```

## Configuration

Device identity is **enabled by default** for all OpenClaw connections.

To disable (not recommended):
```python
config = {
    "url": "ws://127.0.0.1:18789",
    "use_device_identity": False,  # Disable device pairing
    "token": "your-token"  # Fallback to token auth
}
```

## API Usage

### Check Pairing Status

```bash
GET /api/connections/{connection_id}/device-pairing-status
```

Response:
```json
{
  "connection_id": "gw-001",
  "supported": true,
  "enabled": true,
  "paired": true,
  "device_id": "e7bbca08-7ec7-436e-aeea-8a3d5a1b8293",
  "device_name": "CrewHub-MyGateway",
  "platform": "crewhub"
}
```

### Manually Trigger Pairing

```bash
POST /api/connections/{connection_id}/pair-device
```

Response:
```json
{
  "connection_id": "gw-001",
  "success": true,
  "paired": true,
  "device_id": "e7bbca08-7ec7-436e-aeea-8a3d5a1b8293"
}
```

### Pair All Connections (Onboarding)

```bash
POST /api/onboarding/ensure-device-pairing
```

Response:
```json
{
  "success": true,
  "total": 2,
  "paired": 2,
  "connections": [
    {
      "connection_id": "gw-001",
      "connection_name": "My Gateway",
      "status": "paired",
      "device_id": "..."
    }
  ]
}
```

## Testing

Run the device identity test suite:

```bash
cd ~/ekinapps/crewhub/backend
python3 test_device_identity.py
```

Tests cover:
- Device identity generation
- Database persistence
- Keypair serialization (PEM)
- Device token updates
- Get-or-create logic

## Security Notes

- **Private keys** are stored in the database (PEM format, unencrypted)
  - Database file should have restricted permissions
  - Consider encrypting database in production

- **Device tokens** grant full operator access
  - Treat like API keys
  - Revoke tokens if device compromised

- **Ed25519 keypairs** provide strong cryptographic identity
  - 256-bit security level
  - Industry-standard algorithm

## Troubleshooting

### "Missing scope: operator.read" error

**Cause:** Connection using CLI mode without device identity

**Solution:**
1. Enable device identity (default)
2. Trigger pairing: `POST /connections/{id}/pair-device`
3. Reconnect

### Pairing fails with "Connection refused"

**Cause:** Gateway not running or unreachable

**Solution:**
1. Check gateway status: `openclaw gateway status`
2. Start gateway: `openclaw gateway start`
3. Verify connection URL

### Device already paired but still getting scope errors

**Cause:** Device token may be revoked or expired

**Solution:**
1. Check pairing status endpoint
2. Re-pair device (will generate new token)
3. Restart connection

## Migration Guide

### Existing Connections

All existing OpenClaw connections will **automatically upgrade** to device identity on next connect:

1. Connection detects no device identity exists
2. Generates new device keypair
3. Performs pairing with gateway
4. Stores device token
5. Uses device token for authentication

**No manual intervention required!**

### Onboarding Flow

For new installations, call the onboarding endpoint after initial gateway connection:

```javascript
// After successful gateway connection test
await fetch('/api/onboarding/ensure-device-pairing', {
  method: 'POST'
});
```

This ensures all connections are properly paired before use.

## Implementation Reference

Based on OpenClaw device pairing protocol:
- Protocol version: 3
- Method: `devices.pair`
- Authentication: Ed25519 public key cryptography
- Token format: Opaque string (Gateway-issued)

## Dependencies

Added to `requirements.txt`:
```
cryptography>=42.0.0
```

Install:
```bash
pip install cryptography
```

## Future Enhancements

- [ ] Device token rotation
- [ ] Multi-device management UI
- [ ] Device trust levels / scopes
- [ ] Encrypted private key storage
- [ ] Device revocation API

## Credits

Implemented following the OpenClaw Control UI device pairing pattern.

---

**Status:** ✅ Implemented and tested (2026-02-16)
