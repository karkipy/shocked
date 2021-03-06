import { Server } from 'ws';
import { API_RESPONSE, EVENT, SESSION } from 'shocked-common';
import WebSocket from 'isomorphic-ws';
import nanoid from 'nanoid';

import { createClient } from '../src';

const port = process.env.PORT || 9999;

const wss = new Server({ port });

function setupEvent(source, event, timeout = 100) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Timedout')), timeout);
    source.once(event, (...args) => {
      resolve(args);
    });
  });
}

let mockClient = null;
wss.on('connection', (ws, req) => {
  mockClient = ws;
  mockClient.upgradeReq = req;
});

const mockServer = {
  setResponse: (obj) => {
    mockClient.once('message', () => {
      mockClient.send(JSON.stringify(obj));
    });
  },
  getCookie: () => {
    const { cookie } = mockClient.upgradeReq.headers;
    if (!cookie) {
      return null;
    }

    const key = `${SESSION}=`;
    return cookie.split(';').reduce((res, v) => {
      if (v.startsWith(key)) {
        return v.substr(key.length);
      }
      return res;
    }, null);
  },
  sendEvent: (name, data) => {
    mockClient.send(JSON.stringify([EVENT, name, data]));
  },
  close: (code, message) => {
    mockClient.close(code, message);
  },
};

function createMockNetStatus() {
  let listener = null;

  return {
    listen: (cb) => {
      listener = cb;
      listener(false);
      return () => {
        listener = null;
      };
    },
    online() {
      listener(true);
    },
    offline() {
      listener(false);
    },
  };
}

const mockStatus = createMockNetStatus();

describe('createClient specification', () => {
  it('createClient integration', async () => {
    const sessionId = nanoid();
    const client = createClient(`ws://localhost:${port}`, sessionId, { WebSocket });
    await expect(setupEvent(client, 'open')).resolves.toEqual([]);
    expect(mockServer.getCookie()).toBe(sessionId);
    mockServer.setResponse([API_RESPONSE, 1, null, 3]);
    const res = await client.execute('add', [1, 2]);
    expect(res).toBe(3);
    mockServer.setResponse([API_RESPONSE, 2, 'error']);
    await expect(client.execute('add', [1, 2])).rejects.toThrow('error');

    const piEvent = setupEvent(client, 'PI');
    mockServer.sendEvent('PI', Math.PI);
    await expect(piEvent).resolves.toEqual([Math.PI]);
    client.close();
  });

  it('reconnection check', async () => {
    const client = createClient(`ws://localhost:${port}`, null, { netStatus: mockStatus, WebSocket });
    const connecting = setupEvent(client, 'connecting');
    const open = setupEvent(client, 'open');
    const close = setupEvent(client, 'close');
    mockStatus.online();
    await expect(connecting).resolves.toEqual([0]);
    await expect(open).resolves.toEqual([]);
    mockStatus.offline();
    await expect(close).resolves.toEqual([1005]);
    const reopen = setupEvent(client, 'open');
    const rejected = setupEvent(client, 'rejected');
    mockStatus.online();
    await expect(reopen).resolves.toEqual([]);
    mockServer.close(4001);
    await expect(rejected).resolves.toEqual([4001]);
    client.close();
  });
});

afterAll(() => {
  wss.close();
});
