const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
const cookiePparser = require('cookie-parser');
const config = require('./config');
const URL = require('url');

const app = express();

app.use(bodyParser.json({
    limit: '5mb'
}));
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookiePparser());

let cookie = {};

app.all('*', (req, res, next) => {
    let url = getUrl(req.path);
    console.log(url);
    req.headers.Cookie = cookie;

    /*
    req.pipe(request(url))
        .on('response', function (rsp) {
            debugger;
            console.log(rsp);
        })
        .on('error', function (err) {
            debugger;
            console.error(err);
        })
        .pipe(res);
*/

    request({
            url,
            method: req.method,
            headers: req.headers,
            body: req.body,
            json: true
        })
        .on('response', function (rsp) {
            // console.log(rsp);
        })
        .on('error', function (err) {
            console.error(err);
        }).pipe(res);

})


app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
})

app.listen(config.port, () => {
    console.log(`Server listening on ${config.port}`);
})

function login() {
    const {
        username,
        password
    } = config.user;
    const url = config.login;
    const body = {
        mid: config.user.username || 123456,
        mPass: config.user.password || '123456',
        fromHtml: 'adminui'
    };
    const jar = request.jar();
    request.post({
        url,
        body,
        json: true,
        jar
    }, (err, res, body) => {
        if (err) {
            console.error(`Login error ${JSON.stringify(err)}`);
            process.exit(-1);
        } else {
            cookie = res.headers['set-cookie'] || [];
        }
    });
}

login();

function getUrl(path) {
    const p = config.proxy.filter(p => p.path.some(item => path.includes(item)));

    return p.length > 0 ? `${p[0].target}${path}` : `${config.html}${path}`;
}

function get(url, qs, headers = {}) {
    return new Promise((resolve, reject) => {
        request.get({
            url,
            headers,
            qs
        }, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    })

}

function post(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        request.post({
            url,
            headers,
            body,
            json: true,
            jar: true
        }, (err, res, body) => {
            if (err) {
                reject(err);
            } else {
                200 === res.statusCode ? resolve(body) : reject(body);
            }
        });
    })

}