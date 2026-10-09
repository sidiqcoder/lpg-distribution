// Small Fetch router with the request/response contract used by the existing workflows.
export function createRouter() {
  const routes = [];
  const add = method => (path, ...handlers) => {
    const names = [];
    const pattern = path.split('/').map(part => {
      if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    routes.push({ method, regex: new RegExp(`^${pattern}$`), names, handler: handlers.at(-1), upload: handlers.length > 1 ? handlers[0] : null });
  };
  return {
    get: add('GET'), post: add('POST'),
    match(method, path) {
      for (const route of routes) {
        const match = method === route.method && path.match(route.regex);
        if (match) return { ...route, params: Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(match[i + 1])])) };
      }
      return null;
    }
  };
}

export const upload = {
  fields: fields => ({ fields }),
  single: name => ({ single: name, fields: [{ name, maxCount: 1 }] })
};

export async function parseRequest(request, route) {
  const req = { params: route.params, query: Object.fromEntries(new URL(request.url).searchParams), body: {}, files: {} };
  if (request.method === 'GET') return req;
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) req.body = await request.json();
  else if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const [name, value] of form) {
      if (typeof value === 'string') {
        if (name.startsWith('uploaded_')) {
          const fieldName = name.slice(9);
          if (!route.upload?.fields.some(field => field.name === fieldName)) throw Object.assign(new Error('Lampiran tidak valid.'), { status: 400 });
          const file = { savedFilename: value };
          req.files[fieldName] = [file];
          if (route.upload.single === fieldName) req.file = file;
        } else req.body[name] = value;
      }
      else if (value.size > 0) {
        const field = route.upload?.fields.find(field => field.name === name);
        if (!field || req.files[name]?.length >= field.maxCount) throw Object.assign(new Error('Lampiran tidak valid.'), { status: 400 });
        if (value.size > 50 * 1024 * 1024) throw Object.assign(new Error('Ukuran file maksimal 50 MB.'), { status: 413 });
        if (!/^(image\/|video\/|application\/pdf$)/.test(value.type)) throw Object.assign(new Error('File harus berupa foto, video, atau PDF.'), { status: 400 });
        const file = { originalname: value.name, mimetype: value.type, buffer: new Uint8Array(await value.arrayBuffer()) };
        (req.files[name] ||= []).push(file);
        if (route.upload.single === name) req.file = file;
      }
    }
  } else throw Object.assign(new Error('Format permintaan tidak didukung.'), { status: 415 });
  return req;
}

export function createResponse(headers, signMedia) {
  let status = 200;
  let pending;
  return {
    status(code) { status = code; return this; },
    setHeader(name, value) { headers.set(name, value); },
    json(value) {
      pending = signMedia(value).then(data => new Response(JSON.stringify(data), { status, headers: new Headers([...headers, ['Content-Type', 'application/json']]) }));
      return pending;
    },
    send(value) { pending = Promise.resolve(new Response(value, { status, headers })); return pending; },
    finish() { return pending || Promise.resolve(new Response(null, { status: 204, headers })); }
  };
}
