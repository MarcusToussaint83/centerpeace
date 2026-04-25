/**
 * @centerpeace/types
 *
 * Shared TypeScript types across the monorepo.
 * Schemas in this package are the source of truth for data shapes that
 * cross the app/db/solver boundaries. Concrete types arrive in M1+.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OrgId = Brand<string, "OrgId">;
export type UserId = Brand<string, "UserId">;
export type EventId = Brand<string, "EventId">;
export type GuestId = Brand<string, "GuestId">;
export type TableId = Brand<string, "TableId">;
export type SeatId = Brand<string, "SeatId">;
