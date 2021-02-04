'use strict';

// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html

const fs = require('fs');
const https = require('https');
const url = require('url');
const aws4 = require('aws4');
const debug = require('debug')('ts3');

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

// to illustrate usage, we'll create a utility function to request and pipe to stdout
function request(opts) {
  https.request(opts, (res) => {

    if (res.statusCode >= 200 && res.statusCode <= 299) {
      const outfile = fs.createWriteStream('./fetch.tar.gz');
      res.pipe(outfile)
        .on('end', () => console.log(`${green}[${res.statusCode} done]${nc}`));

    } else {
      const chunks = [];
      res.on('data', chunk => {
        chunks.push(chunk);
      })
        .on('end', () => {
          const text = chunks.map(c => c.toString()).join('');
          console.log(`${red}[error ${res.statusCode} done]${nc}`);
          const result = outputError(text);
          if (result.remaining) {
            const remaining = result.remaining;
            delete result.remaining;
            console.log(result);
            console.log(text);
          } else {
            console.log(outputError(result));
          }
        })
        .on('error', e => {
          console.log('request got an error', e.message);
        });

    }
  }).end(opts.body || '');
}

// https://bmac-pre-gyp-test.s3.amazonaws.com/test-using-rest/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz
// aws4 will sign an options object as you'd pass to http.request, with an AWS service and region
const endpoint = 'https://bmac-pre-gyp-test.s3.amazonaws.com/test-using-rest/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz';
// private end point
const pep = 'https://bmac-pre-gyp-test.s3.amazonaws.com/test-private/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz';
//const endpoint = 'https://www.google.com';

const parsedUrl = url.parse(pep);
const { hostname, path } = parsedUrl;
const opts = { hostname, path };
opts.service = 's3';
opts.region = 'us-east-1';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('missing required env var');
}
const aws4Opts = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

let signedOpts;

// try to get aws4 to sign the header that the proxy agent will use. doesn't seem to work. leave this
// false.
const signAnticipatedPath = false;
if (signAnticipatedPath) {
  const original = Object.assign({}, opts);
  opts.hostname = 'bmac-pre-gyp-test.s3.amazonaws.com';
  opts.path = 'http://bmac-pre-gyp-test.s3.amazonaws.com:443/test-private/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz';
  signedOpts = aws4.sign(opts, aws4Opts);
  Object.assign(opts, original);
} else {
  signedOpts = aws4.sign(opts, aws4Opts);
}
console.log('[ signed opts:', signedOpts, ']');

const useAgent = true;
if (useAgent && process.env.http_proxy) {
  const agent = makeAgent(process.env.http_proxy, aws4cb);
  if (agent instanceof Error) {
    throw agent;
  }
  opts.agent = agent;
  debug('[using agent]');
}

function aws4cb (req, opts) {
  debug('req, opts', opts);
  debugger;
  const headers = Object.assign({}, opts.headers);
  delete headers.Authorization;

  const signer = new aws4.RequestSigner({
    service: 's3',
    region: 'us-east-1',
    host: req.host,
    path: req.path,
    headers,
  });
  const sig = signer.authHeader();
  debug('Authorization', sig);
  debug('CanonicalString', signer.canonicalString());
  opts.Authorization = sig;

}

// this removes the Authorization header from signed opts. interesting...
//const rs = new aws4.RequestSigner(opts);
//debug('[RS.canonicalString', rs.canonicalString(), ']');

const fuckupAuth = false;
// force the auth to fail
if (fuckupAuth) {
  console.log(signedOpts);
  const x = (parseInt(signedOpts.headers.Authorization.slice(-1), 16) + 1) & 0xF;
  signedOpts.headers.Authorization = signedOpts.headers.Authorization.slice(0, -1) + x.toString(16);
}
// we can now use this to query AWS
request(signedOpts);
/*
<?xml version="1.0"?>
<ListQueuesResponse xmlns="https://queue.amazonaws.com/doc/2012-11-05/">
...
*/

// aws4 can infer the HTTP method if a body is passed in
// method will be POST and Content-Type: 'application/x-www-form-urlencoded; charset=utf-8'
// request(aws4.sign({ service: 'iam', body: 'Action=ListGroups&Version=2010-05-08' }));
/*
<ListGroupsResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
...
*/

// you can specify any custom option or header as per usual
// request(aws4.sign({
//   service: 'dynamodb',
//   region: 'ap-southeast-2',
//   method: 'POST',
//   path: '/',
//   headers: {
//     'Content-Type': 'application/x-amz-json-1.0',
//     'X-Amz-Target': 'DynamoDB_20120810.ListTables'
//   },
//   body: '{}'
// }));
/*
{"TableNames":[]}
...
*/

// The raw RequestSigner can be used to generate CodeCommit Git passwords
const signer = new aws4.RequestSigner({
  service: 'codecommit',
  host: 'git-codecommit.us-east-1.amazonaws.com',
  method: 'GIT',
  path: '/v1/repos/MyAwesomeRepo',
});
const password = signer.getDateTime() + 'Z' + signer.signature();

// see example.js for examples with other services


function makeAgent(proxyUrl, aws4) {
  const m = proxyUrl.match(/^(?:(http:)\/\/)?([^:]+)(?::(\d{1,4}))?\/?$/);
  if (m) {
    //const ProxyAgent = require(m[1] === 'https:' ? 'https-proxy-agent' : 'http-proxy-agent');
    const ProxyAgent = require('http-proxy-agent');
    const protocol = m[1] === 'https:' ? 'https:' : 'http:';
    const host = m[2];
    const port = +(m[3] || (protocol === 'https:' ? 443 : 80));
    const agentOpts = { host, port, protocol };
    if (aws4) {
      agentOpts.aws4 = aws4;
    }
    return new ProxyAgent(agentOpts);
  } else if (proxyUrl.startsWith('https')) {
    return new Error('https proxy is not supported:', proxyUrl);
  } else {
    return new Error('ignoring invalid proxy config setting %s', proxyUrl);
  }
}

function outputError(text) {
  if (typeof text !== 'string') {
    return {type: typeof text, result: text};
  }

  const prefix = '<?xml version="1.0" encoding="UTF-8"?>\n';

  if (!text.startsWith(prefix)) {
    throw new Error(`text doesn't start with ${prefix}`);
  }
  text = text.slice(prefix.length);

  const errorRE = /<Error><Code>(\S+)<\/Code><Message>(.+)<\/Message>/;
  let m = text.match(errorRE);
  if (!m) {
    throw new Error(`text doesn't match ${errorRE.toString}`);
  }
  const [, code, message] = m;
  text = text.slice(m[0].length);

  let s2s;
  let s2sb;
  // s flag supported node in 8.10.0
  const s2sRE = /<StringToSign>(.+)<\/StringToSign>/ms;
  m = text.match(s2sRE);
  if (m) {
    s2s = m[1];
    text = text.slice(m[0].length);
    const s2sBytesRE = /<StringToSignBytes>([0-9a-f]{2}(?: [0-9a-f]{2})*)<\/StringToSignBytes>/;
    m = text.match(s2sBytesRE);
    if (m) {
      s2sb = Buffer.from(m[1].split(' ').map(c => parseInt(c, 16))).toString('utf8');
      text = text.slice(m[0].length);
    }
  }

  let cr;
  let crb;
  // s flag supported node in 8.10.0
  const crRE = /<CanonicalRequest>(.+)<\/CanonicalRequest>/ms;
  m = text.match(crRE);
  if (m) {
    cr = m[1];
    const crbRE = /<CanonicalRequestBytes>([0-9a-f]{2}(?: [0-9a-f]{2})*)<\/CanonicalRequestBytes>/m;
    m = text.match(crbRE);
    if (m) {
      crb = Buffer.from(m[1].split(' ').map(c => parseInt(c, 16))).toString('utf8');
    }
  }

  const result = { code, message };

  if (s2s) {
    result.s2s = s2s;
    if (s2s !== s2sb) {
      result.s2sb = s2sb;
    }
  } else {
    result.remaining = text;
  }
  if (cr) {
    result.cr = cr;
    if (cr !== crb) {
      result.crb = crb;
    }
  }

  return result;
}




/*
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');

// body is a buffer
const body = fs.readFileSync('../t.tar.gz');
const bodyHash = crypto.createHash('sha256');
bodyHash.update(body);

const canonicalHeaders = [
  'content-type',
  'host',
  'x-amz-acl',
  'x-amx-content-sha256'
];

// */
// const options = {
//   method: 'PUT',
//   body: body,
//   headers: {
//     host: 'bmac-pre-gyp-test.s3.us-east-1.amazonws.com',
//     'accept-encoding': 'gzip,deflate,br',
//     accept: '*/*',
//     'content-length': body.length,
//     'content-type': 'application/octet-stream',
//     expect: '100-continue',
//     'x-amz-acl': 'public-read',
//     'x-amz-content-sha256': bodyHash.digest('hex')
//   }
// };
/*
function makeCanonical(options, uri) {
  const canonical = [];
  const { method, headers } = options;
  canonical.push(method);
  canonical.push(uri);
  // push each header
  for (let i = 0; i < canonicalHeaders.length; i++) {
    canonical.push(`${canonicalHeaders[i]}:${headers[canonicalHeaders[i]]}`);
  }
  // seems like an extra line based on link below
  canonical.push('');
  // the signed headers line
  canonical.push(canonicalHeaders.join(';'));
  // the hashed payload (dup of header it seems)
  canonical.push(headers['x-amz-content-sha256']);

  return canonical.join('\n');
}

function makeStringToSign(canonical) {
  const ts = new Date().toISOString().replace(/-|:|\./g, '');
  const scope = `${ts.slice(0, 8)}/us-east-1/s3/aws4_request`;
  const canonicalHash = crypto.createHash('sha256');
  canonicalHash.update(canonical);
  const s = `AWS4-HMAC-SHA256\n${ts}\n${scope}\n${canonicalHash.digest('hex')}`;
  return {ts, s};
}

const makeSignature(secretKey) {
  let hmac = crypto.createHmac(`AWS4${secretKey}${ts.slice(0, 8)}`);
  hmac = crypto.createHmac(hmac.)
}

/*
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html

<HTTPMethod>\n
<CanonicalURI>\n
<CanonicalQueryString>\n
<CanonicalHeaders>\n
<SignedHeaders>\n
<HashedPayload>

PUT

// */

/* aws s3 --profile iam-bruce cp s3://bmac-pre-gyp-test/test-using-rest/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz s3-cp.tar.gz


[proxy server running at http://localhost:8124]

1)
[[[client connected To proxy]]]
[data: CONNECT bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443 HTTP/1.0

]
[tls: bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443]
[net.createConnectionproxy to bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443 successful]
[tls: writing HTTP/1.1 200 OK\r\n\r\n to client socket]
[connected client-proxy-server pipes]

2)
[[[client connected To proxy]]]
[data: CONNECT bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443 HTTP/1.0

]
[tls: bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443]
[net.createConnectionproxy to bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443 successful]
[tls: writing HTTP/1.1 200 OK\r\n\r\n to client socket]
[connected client-proxy-server pipes]

3)
[[[client connected To proxy]]]
[data: CONNECT bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443 HTTP/1.0

]
[tls: bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443]
[net.createConnectionproxy to bmac-pre-gyp-test.s3.us-west-1.amazonaws.com:443 successful]
[tls: writing HTTP/1.1 200 OK\r\n\r\n to client socket]
[connected client-proxy-server pipes]

4)
[[[client connected To proxy]]]
[data: CONNECT bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443 HTTP/1.0

]
[tls: bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443]
[net.createConnectionproxy to bmac-pre-gyp-test.s3.us-east-1.amazonaws.com:443 successful]
[tls: writing HTTP/1.1 200 OK\r\n\r\n to client socket]
[connected client-proxy-server pipes]

*/

/* part of req in http-proxy-agent callback()
  socketPath: undefined,
  method: 'GET',
  insecureHTTPParser: undefined,
  path: 'http://bmac-pre-gyp-test.s3.amazonaws.com:443/test-using-rest/apm_bindings-v11.0.0-napi-v4-glibc-x64.tar.gz',
  _ended: false,
  res: null,
  aborted: false,
  timeoutCb: null,
  upgradeOrConnect: false,
  parser: null,
  maxHeadersCount: null,
  reusedSocket: false,
  host: 'bmac-pre-gyp-test.s3.amazonaws.com',
  protocol: 'https:',
  [Symbol(kCapture)]: false,
  [Symbol(kNeedDrain)]: false,
  [Symbol(corked)]: 0,
  [Symbol(kOutHeaders)]: [Object: null prototype] {
    host: [ 'Host', 'bmac-pre-gyp-test.s3.amazonaws.com' ],
    'x-amz-content-sha256': [
      'X-Amz-Content-Sha256',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    ],
    'x-amz-date': [ 'X-Amz-Date', '20210202T214008Z' ],
    authorization: [
      'Authorization',
      'AWS4-HMAC-SHA256 Credential=AKIA6Q2LNVSDEAPWGKMD/20210202/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=dae287a0b7f74685e927685a00f96681aeac0ae075f3315ffacb22fe91de5c8d'
    ]
  }

// */
