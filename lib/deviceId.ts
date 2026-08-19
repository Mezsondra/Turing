const KEY = 'turing_device_id';

/**
 * Stable per-device id, so a player's score survives a reload without asking
 * them to sign up. Registered accounts can adopt this row later.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
