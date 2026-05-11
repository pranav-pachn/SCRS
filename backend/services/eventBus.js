/**
 * Simple in-memory Event Bus for Server-Sent Events (SSE)
 * Allows registering admin response streams and emitting events to them.
 */
const clientsByAdmin = new Map(); // adminId -> Set<res>

function addClient(adminId, res) {
  const id = Number(adminId);
  if (!clientsByAdmin.has(id)) clientsByAdmin.set(id, new Set());
  const set = clientsByAdmin.get(id);
  set.add(res);

  // Keep-alive ping
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (e) { /* ignore */ }
  }, 20000);

  // store interval on response so we can clear it later
  res._sseKeepAlive = keepAlive;
}

function removeClient(adminId, res) {
  const id = Number(adminId);
  const set = clientsByAdmin.get(id);
  if (!set) return;
  set.delete(res);
  if (res._sseKeepAlive) clearInterval(res._sseKeepAlive);
  try { res.end(); } catch (e) { /* ignore */ }
  if (set.size === 0) clientsByAdmin.delete(id);
}

function emitToAdmin(adminId, eventName, payload) {
  const id = Number(adminId);
  const set = clientsByAdmin.get(id);
  if (!set) return 0;
  const data = JSON.stringify(payload || {});
  for (const res of set) {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      // ignore write errors; connection cleanup will remove client
    }
  }
  return set.size;
}

module.exports = {
  addClient,
  removeClient,
  emitToAdmin
};
