/**
 * Count bytes written to a ServerResponse for metrics.
 *
 * @param {import("http").ServerResponse} res
 * @returns {() => number}
 */
export function trackResponseBytes(res) {
  let bytes = 0;

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (chunk, encoding, callback) => {
    if (chunk) {
      bytes += Buffer.byteLength(chunk, typeof encoding === "string" ? encoding : undefined);
    }
    return originalWrite(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    if (chunk) {
      bytes += Buffer.byteLength(chunk, typeof encoding === "string" ? encoding : undefined);
    }
    return originalEnd(chunk, encoding, callback);
  };

  return () => bytes;
}
