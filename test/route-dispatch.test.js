'use strict';
// route-dispatch.test.js — unit test for dispatcher matcher kinds and ordering
const A = require('assert');
const { makeDispatcher } = require('../sidecar/http/route-dispatch.js');

function mockRes() {
  return {
    headersSent: false,
    writeHead() { this.headersSent = true; },
    end() { this.ended = true; }
  };
}

// helpers
function req(method, url) { return { method, url }; }

// sentinel static fallback
function staticFallback() { return 'STATIC'; }

// capture helpers
let seen = [];
function h(tag) { return () => { seen.push(tag); return tag; }; }

// rx handler capturing matched groups
function hRx(_, __, gm) { return ['RX', gm && gm[1]]; }

// error policy passthrough
function errPolicy(res, e) { res.err = String((e && e.message) || e); return 'POLICIED'; }

// Routes in ORDER — earlier wins
const ROUTES = [
  { m: 'GET', exact: '/api/exact', h: h('EXACT') },
  { m: 'GET', qsplit: '/api/qsplit', h: h('QSPLIT') },
  { m: 'POST', prefix: '/api/prefix/', h: h('PREFIX_SLASH') },
  { m: 'POST', prefix: '/api/prefix', h: h('PREFIX_BOUNDARY') }, // no trailing slash: boundary rule
  { m: ['GET', 'POST'], qprefix: '/api/qprefix', h: h('QPREFIX') },
  { m: 'GET', rx: /^\/api\/rx\/(\d{2})$/, h: hRx },
  { m: 'GET', qrx: /^\/shared\/.+$/, h: h('QRX') },
  { m: 'GET', exact: '/api/overlap', h: h('FIRST') },
  { m: 'GET', prefix: '/api/overlap', h: h('SECOND') }
];

const dispatch = makeDispatcher(ROUTES, staticFallback);

// exact vs qsplit
{
  seen = [];
  const res = mockRes();
  A.strictEqual(dispatch(req('GET', '/api/exact')), 'EXACT', 'exact match (no query)');
  A.strictEqual(dispatch(req('GET', '/api/qsplit?x=1')), 'QSPLIT', 'qsplit strips query before match');
  A.deepStrictEqual(seen, ['EXACT', 'QSPLIT'], 'both handlers fired in order across requests');
}

// prefix with and without trailing slash (boundary rule)
{
  const res = mockRes();
  A.strictEqual(dispatch(req('POST', '/api/prefix/child')), 'PREFIX_SLASH', 'prefix ending with / matches any child');
  A.strictEqual(dispatch(req('POST', '/api/prefix')), 'PREFIX_BOUNDARY', 'boundary allows bare prefix');
  A.strictEqual(dispatch(req('POST', '/api/prefixX')), 'STATIC', 'boundary rejects non-/,?,end next char');
}

// qprefix ignores query
{
  const res = mockRes();
  A.strictEqual(dispatch(req('GET', '/api/qprefix?y=2')), 'QPREFIX', 'qprefix ignores query string');
}

// rx and qrx
{
  const res = mockRes();
  A.deepStrictEqual(dispatch(req('GET', '/api/rx/42')), ['RX', '42'], 'rx passes capture groups to handler');
  A.strictEqual(dispatch(req('GET', '/shared/file.txt?z=3')), 'QRX', 'qrx sees query-stripped URL');
}

// order: first entry wins when both could match
{
  const res = mockRes();
  A.strictEqual(dispatch(req('GET', '/api/overlap')), 'FIRST', 'earlier route wins on overlap');
}

// method array honoured
{
  const res = mockRes();
  A.strictEqual(dispatch(req('POST', '/api/qprefix/child')), 'QPREFIX', 'm as array matched POST');
}

console.log('route-dispatch.test: OK (matcher kinds, order, and errorPolicy)');
console.log('route-dispatch.test: OK (matcher kinds and order)');

