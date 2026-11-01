const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  const endpointsPath = path.join(__dirname, 'endpoints');
  fs.readdirSync(endpointsPath).forEach(file => {
    const route = require(path.join(endpointsPath, file));
    // cada archivo exporta { path: '/api/tiktok', handler: function }
    app.get(route.path, route.handler);
    console.log(`[LOADED] ${route.path} -> ${file}`);
  });
}
