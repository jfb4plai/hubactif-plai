// Faux req/res compatibles avec le sous-ensemble utilisé des helpers Vercel.
export function fakeReq({ method = 'POST', headers = {}, body, query = {} } = {}) {
  return { method, headers, body, query, socket: { remoteAddress: '1.2.3.4' } }
}

export function fakeRes() {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { res.statusCode = code; return res },
    json(payload) { res.body = payload; return res },
    send(payload) { res.body = payload; return res },
    setHeader(name, value) { res.headers[name.toLowerCase()] = value; return res },
    redirect(code, url) { res.statusCode = code; res.headers.location = url; return res },
  }
  return res
}
