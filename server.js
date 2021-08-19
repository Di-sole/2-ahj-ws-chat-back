const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const WS = require('ws');
const koaBody = require('koa-body');
const uuid = require('uuid');
const app = new Koa();

app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

// => CORS
app.use(async (ctx, next) => {
const origin = ctx.request.get('Origin');
if (!origin) {
  return await next();
}

const headers = { 'Access-Control-Allow-Origin': '*', };

if (ctx.request.method !== 'OPTIONS') {
  ctx.response.set({...headers});
  try {
    return await next();
  } catch (e) {
    e.headers = {...e.headers, ...headers};
    throw e;
  }
}

if (ctx.request.get('Access-Control-Request-Method')) {
  ctx.response.set({
    ...headers,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
  });

  if (ctx.request.get('Access-Control-Request-Headers')) {
    ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
  }

  ctx.response.status = 204;
}
});

// => ROUTER

const router = new Router();

router.get('/', async (ctx, next) => {
  ctx.response.body = 'hello';
});

app.use(router.routes()).use(router.allowedMethods());

// => WS Server

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });

const contacts = [];

wsServer.on('connection', (ws, req) => {
  ws.on('message', async (e) => {
		const msg = JSON.parse(e.toString());

		switch (msg.type) {
			case 'addContact':
				const contact = contacts.find(({ name }) => name === msg.name);
				
				if (contact) {
					ws.send(JSON.stringify({ type: 'logIn', data: 'fail' }));
					return;
				} else {
					contacts.push({name: msg.name});
					ws.send(JSON.stringify({ type: 'logIn', data: 'success' }));
				}
	
				[...wsServer.clients]
				.filter(client => client.readyState === WS.OPEN)
				.forEach(client => client.send(JSON.stringify({ type: 'contacts', data: contacts })));
				break;
			case 'addMessage':
				const message = {
					name: msg.name,
					date: msg.date,
					text: msg.text,
				};
	
				[...wsServer.clients]
				.filter(client => client.readyState === WS.OPEN)
				.forEach(client => client.send(JSON.stringify({ type: 'newMessage', data: message })));
				break;
			case 'deleteContact':
				const index = contacts.findIndex(({ name }) => name === msg.name);
				contacts.splice(index, 1);
				
				[...wsServer.clients]
				.filter(client => client.readyState === WS.OPEN)
				.forEach(client => client.send(JSON.stringify({ type: 'contacts', data: contacts })));
				break;
			default:
				ws.send(JSON.stringify('what are you doing? :)'));
				return;
		}
	});
});

server.listen(port);
