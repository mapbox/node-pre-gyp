'use strict';

//
// this module implements a proxy server that can be used to test proxy
// access.
//

const net = require('net');

/* eslint-disable no-unused-vars */
let red = '';
let green = '';
let yellow = '';
let nc = '';

if (process.stdout.isTTY) {
  red = '\u001b[1;31m';
  green = '\u001b[0;32m';
  yellow = '\u001b[0;33m';
  nc = '\u001b[0m';
}
/* eslint-enable no-unused-vars */

// thank you Nimit Aggarwal
// https://github.com/nimit95/Forward-Proxy/blob/master/server.js

module.exports = {
  server: undefined,

  stopServer() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  },

  startServer(options = {}) {
    this.server = net.createServer();

    const port = options.port || 8124;

    this.server.on('connection', (clientToProxySocket) => {
      console.log(`\n\n${yellow}[[[client connected To proxy]]]${nc}`);
      // We need only the data once, the starting packet
      clientToProxySocket.once('data', (data) => {
        // If you want to see the packet uncomment below
        const sData = data.toString();
        console.log(`[data: ${sData}]`);

        const isTLSConnection = sData.indexOf('CONNECT') !== -1;

        // By Default port is 80
        let serverPort = 80;
        let serverAddress;
        if (isTLSConnection) {
          // Port changed if connection is TLS
          ([serverAddress, serverPort] = sData.split('CONNECT ')[1].split(' ')[0].split(':'));
          console.log(`[tls: ${serverAddress}:${serverPort}]`);
        } else {
          serverAddress = sData.split('Host: ')[1].split('\r\n')[0];
          console.log(`[http: ${serverAddress}:${serverPort}]`);
        }

        const proxyToServerSocket = net.createConnection({
          host: serverAddress,
          port: serverPort
        }, (error) => {
          if (error) {
            console.log(`[net.createConnection error: ${error.message}]`);
            throw error;
          }
          console.log(`[net.createConnectionproxy to ${serverAddress}:${serverPort} successful]`);
          if (isTLSConnection) {
            clientToProxySocket.write('HTTP/1.1 200 OK\r\n\r\n');
            console.log(`${yellow}[tls: writing HTTP/1.1 200 OK\\r\\n\\r\\n to server socket]${nc}`);
          } else {
            proxyToServerSocket.write(data);
            console.log(`${yellow}[http: writing${nc} ${sData} ${yellow}to server socket]${nc}`);
          }

          clientToProxySocket.pipe(proxyToServerSocket);
          proxyToServerSocket.pipe(clientToProxySocket);
          console.log(`${yellow}[connected client-proxy-server pipes]${nc}`);

          proxyToServerSocket.on('error', (err) => {
            console.log('[PROXY TO server ERROR', err, ']');
          });

        });
        clientToProxySocket.on('error', (err) => {
          console.log('[CLIENT TO PROXY ERROR', err, ']');
        });
      });
    });

    this.server.on('error', (err) => {
      console.log('[PROXY SERVER ERROR', err, ']');
      throw err;
    });

    this.server.on('close', () => {
      console.log(`${yellow}[client disconnected]${nc}`);
    });

    this.server.listen(port, () => {
      console.log(`[proxy server running at http://localhost:${port}]`);
    });
  }
};
