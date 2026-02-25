#!/usr/bin/env python3
"""
Quick test script for device identity implementation.

Tests:
1. Device identity generation
2. Database storage & retrieval
3. Keypair serialization
"""

import asyncio
import importlib.util
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Direct import to avoid circular dependency
spec = importlib.util.spec_from_file_location(
    "device_identity", Path(__file__).parent / "app" / "services" / "connections" / "device_identity.py"
)
device_identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(device_identity)

DeviceIdentity = device_identity.DeviceIdentity
DeviceIdentityManager = device_identity.DeviceIdentityManager


async def test_device_identity():
    """Test device identity lifecycle."""
    print("=" * 60)
    print("Device Identity Implementation Test")
    print("=" * 60)

    # Use test database
    test_db = Path.home() / ".crewhub" / "test_device_identity.db"
    if test_db.exists():
        test_db.unlink()
        print(f"✓ Cleaned up test database: {test_db}")

    manager = DeviceIdentityManager(db_path=test_db)

    # Test 1: Generate device identity
    print("\n[Test 1] Generate device identity...")
    identity = await manager.generate_device_identity(
        connection_id="test-conn-001",
        device_name="TestDevice",
        platform="test",
    )
    print(f"✓ Generated device ID: {identity.device_id}")
    print(f"  Device name: {identity.device_name}")
    print(f"  Platform: {identity.platform}")
    print(f"  Has private key: {identity.private_key is not None}")
    print(f"  Has public key: {identity.public_key is not None}")
    print(f"  Device token: {identity.device_token or 'None (not paired yet)'}")

    # Test 2: Retrieve from database
    print("\n[Test 2] Retrieve from database...")
    retrieved = await manager.get_device_identity("test-conn-001")
    assert retrieved is not None, "Failed to retrieve identity"
    assert retrieved.device_id == identity.device_id, "Device ID mismatch"
    print(f"✓ Retrieved device ID: {retrieved.device_id}")
    print(f"  Keypair matches: {retrieved.private_key.private_bytes_raw() == identity.private_key.private_bytes_raw()}")

    # Test 3: Update device token (simulate pairing)
    print("\n[Test 3] Update device token (simulate pairing)...")
    test_token = "test-device-token-12345"
    await manager.update_device_token(identity.device_id, test_token)
    print(f"✓ Updated device token: {test_token[:20]}...")

    # Test 4: Verify token persisted
    print("\n[Test 4] Verify token persisted...")
    updated = await manager.get_device_identity("test-conn-001")
    assert updated.device_token == test_token, "Token not persisted"
    print(f"✓ Token verified: {updated.device_token[:20]}...")

    # Test 5: PEM serialization
    print("\n[Test 5] PEM serialization...")
    public_pem = identity.get_public_key_pem()
    private_pem = identity.get_private_key_pem()
    print(f"✓ Public key PEM (first 50 chars): {public_pem[:50]}...")
    print(f"✓ Private key PEM (first 50 chars): {private_pem[:50]}...")

    # Test 6: Recreate from PEM
    print("\n[Test 6] Recreate identity from PEM...")
    recreated = DeviceIdentity.from_pem(
        device_id=identity.device_id,
        private_key_pem=private_pem,
        device_token=test_token,
        device_name="RecreatedDevice",
        platform="test",
    )
    assert recreated.device_id == identity.device_id, "Device ID mismatch after recreation"
    assert recreated.device_token == test_token, "Token mismatch after recreation"
    assert recreated.get_public_key_pem() == public_pem, "Public key changed after recreation"
    print("✓ Identity recreated from PEM")
    print(f"  Public key matches: {recreated.get_public_key_pem() == public_pem}")

    # Test 7: Get or create (existing)
    print("\n[Test 7] Get or create (existing device)...")
    existing = await manager.get_or_create_device_identity("test-conn-001")
    assert existing.device_id == identity.device_id, "Got different device for same connection"
    print(f"✓ Retrieved existing device: {existing.device_id}")

    # Test 8: Get or create (new)
    print("\n[Test 8] Get or create (new device)...")
    new_device = await manager.get_or_create_device_identity("test-conn-002", "NewDevice")
    assert new_device.device_id != identity.device_id, "Should create new device for different connection"
    print(f"✓ Created new device: {new_device.device_id}")

    # Cleanup
    print("\n[Cleanup]")
    if test_db.exists():
        test_db.unlink()
        print(f"✓ Deleted test database: {test_db}")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! ✓")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_device_identity())
