const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
const cookiePparser = require('cookie-parser');
const URL = require('url');

const app = express();

app.use(bodyParser.json({
    limit: '5mb'
}));
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookiePparser());

app.use(express.static(`${__dirname}/public`));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
})

app.listen(3030, () => {
    console.log(`Server listening on ${3030}`);
})