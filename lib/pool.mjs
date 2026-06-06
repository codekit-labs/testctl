// Run fn over items with at most `limit` in flight; returns results in ORIGINAL order.
// fn is expected to handle its own errors (it should not reject).
export async function mapPool(items, limit, fn) {
  const n = items.length;
  const results = new Array(n);
  const max = Math.max(1, Math.floor(limit) || 1);
  let next = 0;
  async function worker() {
    while (next < n) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(max, n); w += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}
