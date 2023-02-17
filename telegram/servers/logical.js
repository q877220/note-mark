const Chat = require('./botV2');
const moment = require('moment');
const _ = require('lodash');
const ApplicationError = require('../utils/error');
const { db } = require('../utils/database');
const CONST_CFG = require('../utils/constants');
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];


async function getYesterday (session) {
    let end = moment().startOf('day').add(CONST_CFG.ACCOUNT_BEGIN, 'h');
    let start = moment().subtract(1, 'd').startOf('day').add(CONST_CFG.ACCOUNT_BEGIN, 'h');
    let data = {
        id: session.id,
        flag: true,
        date: `${start.format('YYYY-MM-DD')} ${WEEK[moment().format('d')]}`,
        inCnt: 0,
        outCnt: 0,
        inList: [],
        inSummary: [],
        outList: [],
        outSummary: [],
        inTotal: 0,
        rate: 0,
        exchRate: 0,
        distribeTotal: ``,
        hasDistribe: ``,
        unDistribe: ``
    };
    let distribeTotal = 0;
    let hasDistribe = 0;
    try {
        let info = await db('tb_session_info')
            .where({ chat_id: session.id })
            .select('*');

        let records = await db('tb_session_account_detail')
            .where({ chat_id: session.id })
            .andWhere('created_at', '>=', moment.utc(start).format('YYYY-MM-DD HH:mm:ss'))
            .andWhere('created_at', '<', moment.utc(end).format('YYYY-MM-DD HH:mm:ss'))
            .select('*')

        if (info.length > 0) {
            data.rate = info[0].rate;
            data.exchRate = info[0].exchange_rate;
        }

        let inObj = {};
        let outObj = {};
        records.forEach(item => {
            switch (item.direct) {
                case 1:
                case 2:
                    data.inCnt++;
                    data.inTotal += item.money;
                    distribeTotal += item.money / item.rate;
                    data.inList.push({ name: item.name, value: `${item.money} ÷ ${item.rate} = ${_.round(item.money / item.rate, 2)}`, op: item.operator, time: moment(item.created_at).add(8, 'h').format('YYYY-MM-DD HH:mm:ss') });
                    if (inObj[item.name]) {
                        inObj[item.name]['exrVal'] += item.money / item.rate;
                        inObj[item.name]['value'] += item.money;
                    } else {
                        inObj[item.name] = { exrVal: item.money / item.rate, value: item.money };
                    }

                    break;
                case 3:
                    data.outCnt++;
                    let d = { name: item.name, value: `${session.numFormat(item.money)}u`, op: item.operator, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') };

                    if (!outObj[item.name]) {
                        outObj[item.name] = { exrVal: 0, value: 0 };
                    }

                    if (item.rate === 1) {
                        hasDistribe += item.money / item.rate;
                        outObj[item.name]['exrVal'] += item.money / item.rate;
                        outObj[item.name]['value'] += item.money;
                        d.value = `${session.numFormat(item.money)} | ${session.numFormat(item.money / session.getExchRate)}u`;
                    } else {
                        hasDistribe += item.money;
                        outObj[item.name]['exrVal'] += item.money;
                        outObj[item.name]['value'] += item.money * item.rate;
                        d.value = `${session.numFormat(item.money)}u`;
                    }

                    data.distribeTotal = `${session.numFormat(distribeTotal * (1 - session.getRate()))} USDT`;
                    data.hasDistribe = `${session.numFormat(hasDistribe)} USDT`;
                    data.unDistribe = `${session.numFormat(distribeTotal * (1 - session.getRate()) - hasDistribe)} USDT`
                    data.outList.push(d);
                    break;
            }
        });

        for (let key in inObj) {
            data.inSummary.push({ name: key, value: `${session.numFormat(obj[key].value)} | ${session.numFormat(obj[key].exrVal, 2)}` });
        }

        for (let key in outObj) {
            data.outSummary.push({ name: key, value: `${session.numFormat(obj[key].value)} | ${session.numFormat(obj[key].exrVal, 2)}` });
        }

        return data;
    } catch (e) {
        console.error(e);
        return data;
    }
}


function billData (session) {
    let data = {
        id: session.id,
        flag: false,
        date: `${moment().format('YYYY-MM-DD')} ${WEEK[moment().format('d')]}`,
        inCnt: session.inCnt,
        outCnt: session.outCnt,
        inList: [],
        inSummary: [],
        outList: [],
        outSummary: [],
        inTotal: session.numFormat(session.inTotal),
        rate: session.getRate(),
        exchRate: session.isSetExchRate() ? parseFloat(session.getExchRate()).toFixed(2) : 0,
        distribeTotal: `${session.numFormat(session.inEXRTotal * (1 - session.getRate() / 100))} USDT`,
        hasDistribe: `${session.numFormat(session.outEXRTotal)} USDT`,
        unDistribe: `${session.numFormat(session.inEXRTotal * (1 - session.getRate() / 100) - session.outEXRTotal)} USDT`
    };

    let obj = {};
    session.inAccount.forEach(item => {
        data.inList.push({ name: item.name, value: `${item.value} ÷ ${item.exr} = ${_.round(item.value / item.exr, 2)}`, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') })
        if (!obj[item.name]) {
            obj[item.name] = { exrVal: 0, value: 0 };
        }

        obj[item.name]['exrVal'] += item.value / item.exr;
        obj[item.name]['value'] += item.value;
    });
    for (let key in obj) {
        data.inSummary.push({ name: key, value: `${session.numFormat(obj[key].value)} | ${session.numFormat(obj[key].exrVal)}u` });
    }

    obj = {};
    session.outAccount.forEach(item => {
        let d = { name: item.name, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') };

        if (!obj[item.name]) {
            obj[item.name] = { exrVal: 0, value: 0 };
        }

        if (!item.unit) {
            obj[item.name]['exrVal'] += item.value / session.getExchRate();
            obj[item.name]['value'] += item.value;
            d.value = `${session.numFormat(item.value)} | ${session.numFormat(item.value / session.getExchRate())}u`;
        } else {
            obj[item.name]['exrVal'] += item.value;
            obj[item.name]['value'] += item.value * item.exr;
            d.value = `${session.numFormat(item.value)}u`;
        }

        data.outList.push(d);
    });

    for (let key in obj) {
        data.outSummary.push({ name: key, value: `${session.numFormat(obj[key].value)} | ${session.numFormat(obj[key].exrVal)}u` });
    }

    return data;
}

function startBot (app, name, type) {
    delete require.cache[require.resolve('../config/robot.json')];
    let botCfg = require('../config/robot.json');
    if (botCfg[name] && botCfg[name].type === type) {
        let { token } = botCfg[name];
        let robots = app.get('robot');
        if (robots[name]) {
            throw new ApplicationError(2000, '', { bot: name });
        }
        let session = new Chat(token, name);
        robots[name] = session;
        app.set('robot', robots);
    } else {
        throw new ApplicationError(4000, '', { bot: name });
    }
}

function findBotByName (app, name) {
    let robots = app.get('robot');
    return robots[name] || null;
}

function findBotSession (app, chat_id) {
    let session = null;
    let robots = app.get('robot');
    for (let key in robots) {
        session = robots[key].getChatSessionByChat(chat_id);
        if (session) {
            return session;
        }
    }
    return session;
}

module.exports = {
    billData,
    getYesterday,
    startBot,
    findBotByName,
    findBotSession
}