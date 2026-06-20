const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3456;
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const PROJECT_NAME = 'spark-sidebar';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

// Create vercel.json in dist to set project name
function writeVercelConfig() {
  fs.writeFileSync(path.join(DIST, 'vercel.json'), JSON.stringify({
    headers: [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" }
        ]
      }
    ]
  }, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API: Deploy
  if (req.method === 'POST' && req.url === '/api/deploy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { css, js } = JSON.parse(body);

        fs.writeFileSync(path.join(DIST, 'spark-sidebar.css'), css, 'utf8');
        fs.writeFileSync(path.join(DIST, 'spark-sidebar.js'), js, 'utf8');
        writeVercelConfig();

        console.log('Deploying to Vercel...');
        const result = execSync(
          `vercel deploy "${DIST}" --name ${PROJECT_NAME} --prod --yes 2>&1`,
          { cwd: ROOT, encoding: 'utf8', timeout: 90000 }
        );

        console.log('Vercel output:', result);

        // Parse URLs from output - look for Production and Aliased lines
        let deployUrl = '';
        const aliasMatch = result.match(/Aliased:\s+(https:\/\/[^\s\[]+)/);
        const prodMatch = result.match(/Production:\s+(https:\/\/[^\s\[]+)/);

        if (aliasMatch) {
          deployUrl = aliasMatch[1];
        } else if (prodMatch) {
          deployUrl = prodMatch[1];
        } else {
          // Fallback: grab any https URL
          const urls = result.match(/https:\/\/[^\s\[\]]+\.vercel\.app/g);
          if (urls) deployUrl = urls[urls.length - 1];
        }

        // Clean trailing chars
        deployUrl = deployUrl.replace(/[\s\[\]]+$/, '');

        console.log('Deploy URL:', deployUrl);

        if (!deployUrl) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Could not parse deploy URL', output: result }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          url: deployUrl,
          cssUrl: deployUrl + '/spark-sidebar.css',
          jsUrl: deployUrl + '/spark-sidebar.js',
          output: result,
        }));
      } catch (err) {
        console.error('Deploy error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: err.message,
          output: (err.stdout || '') + (err.stderr || ''),
        }));
      }
    });
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, decodeURIComponent(filePath));

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Spark Sidebar Customizer`);
  console.log(`  http://localhost:${PORT}\n`);
});
