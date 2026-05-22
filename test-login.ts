// 测试登录请求的脚本
// 运行方式: node test-login.ts
// 需要先确保后端在 http://localhost:3000 运行

const http = require('http');

const data = JSON.stringify({
  identifier: 'test',
  password: 'test123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('响应体:', body);
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.write(data);
req.end();
