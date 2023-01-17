const createError = require('http-errors');
const moment = require('moment');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const Chat = require('./botV2');

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

app.all('/sendMsg', (req, res) => {

    const data = req.body;
    app.get('robot').emit('text', data);
    res.json({ errno: 0 })
});

app.all('/getBill', (req, res) => {

    const { chat_id, date } = req.query;
    let record = getSession(chat_id);

    if (record) {
        let data = {
            date: moment().format('YYYY-MM-DD HH:mm:ss'),
            inCnt: record.inCnt,
            outCnt: record.outCnt,
            inList: record.inAccount,
            inSummary: { name: 'test', value: 100 },
            outList: record.outAccount,
            outSummary: { name: 'test', value: 100 },
            inTotal: record.inTotal,
            rate: record.rate,
            exchRate: record.exchRate,
            outTotal: record.outTotal
        };
        res.render('bill', { data });
    } else {
        res.json({ errno: -200 })
    }
});

app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json({ errno: res.status || 500 });
});

(function start () {
    try {
        app.listen(3001, () => {
            console.log(`Server listened on 3001`);
        });

        const token = '5933218654:AAEBsQGf3vzBkGWsfk2ZQ2zBreyBvGPIqyw';
        let session = new Chat(token);
        app.set('robot', session.bot);

    } catch (e) {
        console.error(`Server init error ===> ${JSON.stringify(e)}`);
        process.exit(-1);
    }
})()
