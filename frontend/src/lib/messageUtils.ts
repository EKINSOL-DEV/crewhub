/**
 * Utility functions for message content display.
 */

/**
 * Matches OpenClaw reply-tags, e.g.:
 *   [[reply_to_current]]
 *   [[reply_to:<id>]]
 *   [[ reply_to: some-id ]]
 */
const OPENCLAW_TAG_RE = /\[\[\s*reply_to[^\]]*\]\]/g

/**
 * Strip OpenClaw reply-tags from a message string before display.
 * Only apply at render time — never mutate stored data.
 */
export function stripOpenClawTags(text: string): string {
  return text.replace(OPENCLAW_TAG_RE, '').trim()
}
