const express = require('express');
const app = express();
app.use(express.static('public'));
require('./routes')(app);
app.listen(3000, ()=>console.log('LOCOS-API en http://localhost:3000'));
