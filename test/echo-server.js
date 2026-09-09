// test/echo-server.js — 回显收到的请求头，供断言
const http = require("http");
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers }));
  });
});
server.listen(18899, "127.0.0.1", () => console.log("echo on 18899"));
