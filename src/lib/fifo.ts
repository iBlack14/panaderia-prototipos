export interface Lote {
  qty: number;
  cost: number;
}

/**
 * Consumes a specified quantity from a FIFO list of batches (lotes).
 * Returns the updated list of batches. Excludes batches that have been fully consumed.
 */
export function consumeLotesFIFO(lotes: Lote[], amount: number): Lote[] {
  const result: Lote[] = [];
  let rem = amount;

  for (const item of lotes) {
    if (rem > 0) {
      if (item.qty > rem) {
        result.push({ qty: item.qty - rem, cost: item.cost });
        rem = 0;
      } else {
        rem -= item.qty;
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Gets the unit cost of the oldest active (non-empty) batch.
 * Defaults to the cost of the last batch if all are empty, or 0.
 */
export function getLotesUnitCost(lotes: Lote[]): number {
  const firstActive = lotes.find(l => l.qty > 0);
  if (firstActive) return firstActive.cost;
  
  if (lotes.length > 0) return lotes[lotes.length - 1].cost;
  return 0;
}

/**
 * Computes the total cost of consuming a specified amount of stock from FIFO batches.
 * If the amount to consume exceeds the total stock, the excess is valued at the last batch's cost.
 */
export function getFIFOCost(lotes: Lote[], amount: number): number {
  let rem = amount;
  let totalCost = 0;

  for (const item of lotes) {
    if (rem <= 0) break;
    const taken = Math.min(item.qty, rem);
    totalCost += taken * item.cost;
    rem -= taken;
  }

  // If there's still an amount left after exhausting all batches, value it at the cost of the last batch (or 0)
  if (rem > 0 && lotes.length > 0) {
    totalCost += rem * lotes[lotes.length - 1].cost;
  }

  return totalCost;
}
