/**
 * useRooms hook - consumes room data from RoomsContext
 * 
 * This hook is a thin wrapper around useRoomsContext for backwards compatibility.
 * All data fetching is centralized in RoomsContext to prevent duplicate API calls.
 */
import { useRoomsContext } from "@/contexts/RoomsContext"

// Re-export types from context for backwards compatibility
export type { Room, SessionRoomAssignment, RoomAssignmentRule } from "@/contexts/RoomsContext"

export function useRooms() {
  return useRoomsContext()
}
