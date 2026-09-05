/**
 * The guess screen froze because connect() built a second socket whenever the
 * first one happened to be down, stranding every listener bound to the first.
 * This asserts the socket is a singleton and that listeners survive a drop.
 */
import assert from 'node:assert';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

// Browser globals socketService reaches for, via lib/deviceId and lib/api.
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: () => 'test-device',
  setItem: () => {},
} as unknown as Storage;

const httpServer = createServer();
const io = new Server(httpServer);
io.on('connection', (socket) => {
  socket.on('submit-guess', () => socket.emit('guess-result', { wasCorrect: true }));
});
await new Promise<void>((r) => httpServer.listen(0, r));
const port = (httpServer.address() as { port: number }).port;

const { SocketService } = await import('./socketService.ts');
const service = new SocketService();
(service as unknown as { serverUrl: string }).serverUrl = `http://localhost:${port}`;

await service.connect();
const first = (service as unknown as { socket: { id: string } }).socket;

// A listener registered once, the way App.tsx does it, must keep working.
let results = 0;
service.onGuessResult(() => { results += 1; });

// Drop the connection, then call connect() again the way ChatScreen does.
io.disconnectSockets(true);
await new Promise((r) => setTimeout(r, 200));
await service.connect();

const second = (service as unknown as { socket: { id: string } }).socket;
assert.strictEqual(first, second, 'connect() replaced the socket, orphaning its listeners');

service.submitGuess('m1', 'HUMAN');
await new Promise((r) => setTimeout(r, 300));
assert.strictEqual(results, 1, 'guess-result never reached the listener after a reconnect');

service.disconnect();
io.close();
httpServer.close();
console.log('socketService: socket survives a reconnect with listeners intact ✓');
process.exit(0);
