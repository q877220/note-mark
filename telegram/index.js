const createError = require('http-errors');
const express = require('express');
const moment = require('moment');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const server = require('./servers/logical');
const ApplicationError = require('./utils/error');

const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.resolve(__dirname, 'public')));

app.set('views', path.join(__dirname, 'public', 'views'));
app.set('view engine', 'ejs');

app.all('/sendMsg', (req, res, next) => {
    const { bot, data } = req.body;
    let robot = server.findBotByName(app, bot);
    if (robot) {
        robot.bot.emit('text', data);
        res.json({ errno: 0 })
    } else {
        next(new ApplicationError(4001));
    }
});

app.post('/startBot', (req, res, next) => {
    try {
        const { bot, type } = req.body;
        server.startBot(app, bot, type)
        res.json({ errno: 0 });
    } catch (e) {
        if (e instanceof ApplicationError) {
            next(e);
        } else {
            next(new ApplicationError(5000, e, { code }));
        }
    }
});

app.all('/addAdmin', (req, res, next) => {
    const { bot, uid, username, first_name, last_name, role, days } = req.body;
    let robot = server.findBotByName(app, bot);
    if (robot) {
        robot.addAdministrator({ uid, username, first_name, last_name, role, expired: moment().add(days * 24, 'h').format('YYYY-MM-DD HH:mm:ss') });
        res.json({ errno: 0 })
    } else {
        next(new ApplicationError(4001));
    }
});

app.all('/setBotExpired', (req, res, next) => {
    let { bot, uid, hours } = req.body;
    hours = parseInt(hours);
    if (!hours || 0 >= hours || !uid) {
        next(new AbortController(1001));
    }
    let robot = server.findBotByName(app, bot);
    if (robot) {
        let errmsg = robot.setExpired(uid, hours);
        res.json({ errno: 0, errmsg });
    } else {
        next(new ApplicationError(4001));
    }
});

app.all('/getBill', async (req, res, next) => {
    const { c, d } = req.query;
    let robot = server.findBotByChat(app, parseInt(c));
    if (robot) {
        let session = robot.getChatSession(parseInt(c));
        let data = {};
        if (d === 'y') {
            data = await server.getYesterday(session);
        } else {
            data = server.billData(session);
        }
        res.render('bill', { data });
    } else {
        next(new ApplicationError(4001));
    }
});

app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    res.json({ errno: err.errno || 5000, errmsg: err.message });
});

(function start () {
    try {
        app.listen(3002, () => {
            console.log(`Server listened on 3002`);
        });

        app.set('robot', {});
    } catch (e) {
        console.error(`Server init error ===> ${JSON.stringify(e)}`);
        process.exit(-1);
    }
})()
