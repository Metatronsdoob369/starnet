'use strict';

// sidecar/http/route-dispatch.js — pure route dispatcher factory.
// Exports a factory that closes over a routes table and a static-fallback
// handler, returning a Node-style (req,res) dispatcher function.
//
// IMPORTANT: Do NOT use Date/Math/performance here — determinism lint scans
// all sidecar modules except the ambient composition root (index.js).

function routePrefixMatches(url, prefix) {
  if (url.indexOf(prefix) !== 0) return false;
  if (prefix.charAt(prefix.length - 1) === '/') return true;
  const next = url.charAt(prefix.length);
  return next === '' || next === '?' || next === '/';
}

function makeDispatcher(routes, serveStatic) {
  if (!Array.isArray(routes)) throw new Error('makeDispatcher: routes must be an array');
  if (typeof serveStatic !== 'function') throw new Error('makeDispatcher: serveStatic must be a function');
  return function dispatchRoute(req, res) {
    const url = req.url || '';
    const bare = url.split('?')[0];
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      if (Array.isArray(r.m) ? r.m.indexOf(req.method) < 0 : r.m !== req.method) continue;
      let gm = null;
      if (r.exact !== undefined) { if (url !== r.exact) continue; }
      else if (r.qsplit !== undefined) { if (bare !== r.qsplit) continue; }
      else if (r.prefix !== undefined) { if (!routePrefixMatches(url, r.prefix)) continue; }
      else if (r.qprefix !== undefined) { if (!routePrefixMatches(bare, r.qprefix)) continue; }
      else if (r.rx) { gm = url.match(r.rx); if (!gm) continue; }
      else if (r.qrx) { if (!r.qrx.test(bare)) continue; }
      else continue;   // malformed entry: never match (fail closed to the static fallthrough)
      const out = r.h(req, res, gm);
      return r.errorPolicy ? out.catch((e) => r.errorPolicy(res, e)) : out;
    }
    return serveStatic(req, res);
  };
}

module.exports = { makeDispatcher };

