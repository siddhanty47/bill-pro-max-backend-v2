/**
 * @file Inventory utilities
 * @description Shared helpers for computing rented/available from quantity history
 */

import { IQuantityTransaction } from '../models';

/**
 * Get rentedDelta for a transaction, with fallback for legacy entries without rentedDelta.
 */
function getRentedDelta(tx: IQuantityTransaction): number {
  if (tx.rentedDelta != null) return tx.rentedDelta;
  // Fallback for legacy entries
  switch (tx.type) {
    case 'challan_delivery':
      return tx.quantity;
    case 'challan_return':
      return -tx.quantity;
    case 'challan_delivery_reversed':
      return -tx.quantity;
    case 'challan_return_reversed':
      return tx.quantity;
    case 'challan_item_edit':
      return 0; // Cannot infer without challanType
    default:
      return 0;
  }
}

/**
 * Compute rented quantity from quantity history by summing rentedDelta.
 */
export function computeRentedFromHistory(quantityHistory: IQuantityTransaction[] | undefined): number {
  return (quantityHistory || []).reduce((sum, tx) => sum + getRentedDelta(tx), 0);
}
