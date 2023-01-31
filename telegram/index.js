const createError = require('http-errors');
const moment = require('moment');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const _ = require('lodash');

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
    const { c } = req.query;
    let record = app.get('robotSession').getChatSession(parseInt(c));

    if (record) {
        let data = billData(record);
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

        // const token = '5933218654:AAEBsQGf3vzBkGWsfk2ZQ2zBreyBvGPIqyw'; //Fsgubl07bot 聪明1号
        const token = '6046551964:AAHG4LupNUV0EItFdljFSnUpZ_C2qoD0A4s'; //@buGm107bot  聪明2号
        let session = new Chat(token);
        app.set('robot', session.bot);
        app.set('robotSession', session);

    } catch (e) {
        console.error(`Server init error ===> ${JSON.stringify(e)}`);
        process.exit(-1);
    }
})()

/**
 * 
 * @param {*} record  ChatSession
 */
function billData (record) {
    const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    let data = {
        date: `${moment().format('YYYY-MM-DD')} ${week[moment().format('d')]}`,
        inCnt: record.inCnt,
        outCnt: record.outCnt,
        inList: [],
        inSummary: [],
        outList: [],
        outSummary: [],
        inTotal: record.numFormat(record.inTotal),
        rate: record.rate,
        exchRate: record.exchRate ? parseFloat(record.exchRate).toFixed(2) : 0,
        distribeTotal: `${record.numFormat(_.round(record.inEXRTotal * (1 - record.rate / 100), 2))} USDT`,
        hasDistribe: `${record.numFormat(_.round(record.outEXRTotal, 2))} USDT`,
        unDistribe: `${record.numFormat(_.round(record.inEXRTotal * (1 - record.rate / 100) - record.outEXRTotal, 2))} USDT`
    };

    let obj = {};
    record.inAccount.forEach(item => {
        data.inList.push({ name: item.name, value: `${item.value} ÷ ${item.exr} = ${_.round(item.value / item.exr, 2)}`, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') })
        if (obj[item.name]) {
            obj[item.name]['exrVal'] += item.value / item.exr;
            obj[item.name]['value'] += item.value;
        } else {
            obj[item.name] = { exrVal: item.value / item.exr, value: item.value };
        }
    });
    for (let key in obj) {
        data.inSummary.push({ name: key, value: `${record.numFormat(obj[key].value)} | ${record.numFormat(_.round(obj[key].exrVal, 2))}` });
    }

    obj = {};
    record.outAccount.forEach(item => {
        data.outList.push({ name: item.name, value: `${record.numFormat(item.value)}u`, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') })
        if (obj[item.name]) {
            obj[item.name] += item.value;
        } else {
            obj[item.name] = item.value;
        }
    });
    for (let key in obj) {
        data.outSummary.push({ name: key, value: `${record.numFormat(obj[key])}u` });
    }

    return data;
}