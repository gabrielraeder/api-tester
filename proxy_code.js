// const fs = require("fs");
// const port = process.env.PORT || 8080;
// const host = process.env.HOST || '0.0.0.0';

// const cors_proxy = require('cors-anywhere');
// cors_proxy.createServer({
//     originWhitelist: [], // Allow all origins
//     requireHeader: ['origin', 'x-requested-with'],
//     removeHeaders: ['cookie', 'cookie2'],
//     httpsOptions: {
//         key: fs.readFileSync('./server-key.pem'),
//         cert: fs.readFileSync('./server-cert.pem'),
//     }
// }).listen(port, host, function () {
//     console.log('Running CORS Anywhere on ' + host + ':' + port);
// });

const fs = require("fs");
const https = require("https");
const cors_proxy = require("cors-anywhere");

// Listen on a specific host via the HOST environment variable
const host = process.env.HOST || "0.0.0.0";
// Listen on a specific port via the PORT environment variable
const port = process.env.PORT || 8080;

// Path to your SSL certificate files
const privateKey = fs.readFileSync("/etc/letsencrypt/live/proxy.writechoice.io/privkey.pem", "utf8");
const certificate = fs.readFileSync("/etc/letsencrypt/live/proxy.writechoice.io/fullchain.pem", "utf8");
// const ca = fs.readFileSync('/etc/letsencrypt/live/proxy.writechoice.io/fullchain.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

cors_proxy
  .createServer({
    originWhitelist: [], // Allow all origins
    requireHeader: ["origin", "x-requested-with"],
    removeHeaders: ["cookie", "cookie2"],
    httpsOptions: credentials,
  })
  .listen(port, host, function () {
    console.log("Running CORS Anywhere on " + host + ":" + port);
  });

// https.createServer(credentials, function (req, res) {
//     // Your server code here
// }).listen(port, host, function () {
//     console.log('HTTPS Server running on ' + host + ':' + port);
// });
