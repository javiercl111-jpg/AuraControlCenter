import type {
  GrowthExternalActionResultV1,
} from './GrowthExternalActionContractV1';


export type GrowthExternalActionIdempotencyClaimStateV1 =
  | 'CLAIMED'
  | 'ALREADY_CLAIMED';


export interface GrowthExternalActionIdempotencyClaimV1 {
  readonly key: string;
  readonly state:
    GrowthExternalActionIdempotencyClaimStateV1;

  /**
   * Present when an implementation can identify
   * the owner/action that originally claimed the key.
   */
  readonly ownerActionId?: string;
}


export interface GrowthExternalActionIdempotencyRecordV1 {
  readonly key: string;
  readonly actionId: string;

  readonly createdAt: string;
  readonly completedAt?: string;

  readonly result?:
    GrowthExternalActionResultV1;
}


export interface GrowthExternalActionIdempotencyPortV1 {

  /**
   * Attempts to reserve the idempotency key.
   *
   * Production implementations must make this operation atomic.
   */
  claim(
    key: string,
    actionId: string,
  ): Promise<GrowthExternalActionIdempotencyClaimV1>;


  /**
   * Returns the current record when the key
   * was previously observed.
   */
  get(
    key: string,
  ): Promise<
    GrowthExternalActionIdempotencyRecordV1 | null
  >;


  /**
   * Stores the terminal or reusable result associated
   * with the idempotency key.
   */
  complete(
    key: string,
    actionId: string,
    result: GrowthExternalActionResultV1,
  ): Promise<void>;

}