/* eslint-disable */
var https = require('https')
var aws4  = require('aws4')

// to illustrate usage, we'll create a utility function to request and pipe to stdout
function request(opts) { https.request(opts, function(res) { res.pipe(process.stdout) }).end(opts.body || '') }

// aws4 will sign an options object as you'd pass to http.request, with an AWS service and region
var opts = { host: 'my-bucket.s3.us-west-1.amazonaws.com', path: '/my-object', service: 's3', region: 'us-west-1' }

// aws4.sign() will sign and modify these options, ready to pass to http.request
aws4.sign(opts, { accessKeyId: '', secretAccessKey: '' })

// or it can get credentials from process.env.AWS_ACCESS_KEY_ID, etc
aws4.sign(opts)

// for most AWS services, aws4 can figure out the service and region if you pass a host
opts = { host: 'my-bucket.s3.us-west-1.amazonaws.com', path: '/my-object' }

// usually it will add/modify request headers, but you can also sign the query:
opts = { host: 'my-bucket.s3.amazonaws.com', path: '/?X-Amz-Expires=12345', signQuery: true }

// and for services with simple hosts, aws4 can infer the host from service and region:
opts = { service: 'sqs', region: 'us-east-1', path: '/?Action=ListQueues' }

// and if you're using us-east-1, it's the default:
opts = { service: 'sqs', path: '/?Action=ListQueues' }

aws4.sign(opts)
console.log(opts)
/*
{
  host: 'sqs.us-east-1.amazonaws.com',
  path: '/?Action=ListQueues',
  headers: {
    Host: 'sqs.us-east-1.amazonaws.com',
    'X-Amz-Date': '20121226T061030Z',
    Authorization: 'AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/sqs/aws4_request, ...'
  }
}
*/

// we can now use this to query AWS
request(opts)
/*
<?xml version="1.0"?>
<ListQueuesResponse xmlns="https://queue.amazonaws.com/doc/2012-11-05/">
...
*/

// aws4 can infer the HTTP method if a body is passed in
// method will be POST and Content-Type: 'application/x-www-form-urlencoded; charset=utf-8'
request(aws4.sign({ service: 'iam', body: 'Action=ListGroups&Version=2010-05-08' }))
/*
<ListGroupsResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
...
*/

// you can specify any custom option or header as per usual
request(aws4.sign({
  service: 'dynamodb',
  region: 'ap-southeast-2',
  method: 'POST',
  path: '/',
  headers: {
    'Content-Type': 'application/x-amz-json-1.0',
    'X-Amz-Target': 'DynamoDB_20120810.ListTables'
  },
  body: '{}'
}))
/*
{"TableNames":[]}
...
*/

// The raw RequestSigner can be used to generate CodeCommit Git passwords
var signer = new aws4.RequestSigner({
  service: 'codecommit',
  host: 'git-codecommit.us-east-1.amazonaws.com',
  method: 'GIT',
  path: '/v1/repos/MyAwesomeRepo',
})
var password = signer.getDateTime() + 'Z' + signer.signature()

// see example.js for examples with other services
