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
        distribeTotal: 0,
        hasDistribe: 0,
        unDistribe: 0
    };
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
        let outTotal = 0;
        records.forEach(item => {
            switch (item.direct) {
                case 1:
                case 2:
                    data.inCnt++;
                    data.inTotal += item.money;
                    data.inList.push({ name: item.name, value: `${item.money}`, op: item.operator, time: moment(item.created_at).add(8, 'h').format('YYYY-MM-DD HH:mm:ss') });
                    if (inObj[item.name]) {
                        inObj[item.name]['value'] += item.money;
                    } else {
                        inObj[item.name] = { value: item.money };
                    }

                    break;
                case 3:
                    data.outCnt++;
                    let d = { name: item.name, value: `${session.numFormat(item.money)}`, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') };

                    if (!outObj[item.name]) {
                        outObj[item.name] = { value: 0 };
                    }

                    if (item.rate === 1) {
                        outTotal += item.money;
                        outObj[item.name]['value'] += item.money;
                        d.value = `${session.numFormat(item.money)}`;
                    } else {
                        outTotal += item.money * item.rate;
                        outObj[item.name]['value'] += item.money * item.rate;
                        d.value = `${session.numFormat(item.money)}u | (${session.numFormat(item.money * item.rate)})`;
                    }

                    data.outList.push(d);
                    break;
            }
        });



        for (let key in inObj) {
            data.inSummary.push({ name: key, value: `${session.numFormat(inObj[key].value)}` });
        }

        for (let key in outObj) {
            data.outSummary.push({ name: key, value: `${session.numFormat(outObj[key].value)}` });
        }

        let discribeT = _.round(data.inTotal * (1 - session.getRate() / 100), 2);
        let hasDistribe = _.round(outTotal, 2);
        let unDistribe = _.round(discribeT - hasDistribe, 2);

        data.distribeTotal = `${session.numFormat(discribeT)}`;
        data.hasDistribe = `${session.numFormat(hasDistribe)}`;
        data.unDistribe = `${session.numFormat(unDistribe)}`;

        if (session.isSetExchRate()) {
            data.distribeTotal = `${data.distribeTotal} | ${session.numFormat(discribeT / session.getExchRate())} USDT`;
            data.hasDistribe = `${data.hasDistribe} | ${session.numFormat(hasDistribe / session.getExchRate())} USDT`;
            data.unDistribe = `${data.unDistribe} | ${session.numFormat(unDistribe / session.getExchRate())} USDT`;
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
        exchRate: session.isSetExchRate() ? session.getExchRate() : 0,
        distribeTotal: ``,
        hasDistribe: ``,
        unDistribe: ``
    };

    let discribeT = _.round(session.inTotal * (1 - session.getRate() / 100), 2);
    let hasDistribe = _.round(session.outTotal, 2);
    let unDistribe = _.round(discribeT - hasDistribe, 2);

    data.distribeTotal = `${session.numFormat(discribeT)}`;
    data.hasDistribe = `${session.numFormat(hasDistribe)}`;
    data.unDistribe = `${session.numFormat(unDistribe)}`;

    if (session.isSetExchRate()) {
        data.distribeTotal = `${data.distribeTotal} | ${session.numFormat(discribeT / session.getExchRate())} USDT`;
        data.hasDistribe = `${data.hasDistribe} | ${session.numFormat(hasDistribe / session.getExchRate())} USDT`;
        data.unDistribe = `${data.unDistribe} | ${session.numFormat(unDistribe / session.getExchRate())} USDT`;
    }

    let obj = {};
    session.inAccount.forEach(item => {
        data.inList.push({ name: item.name, value: `${item.value}`, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') })
        if (!obj[item.name]) {
            obj[item.name] = { value: 0 };
        }

        obj[item.name]['value'] += item.value;
    });
    for (let key in obj) {
        data.inSummary.push({ name: key, value: `${session.numFormat(obj[key].value)}` });
    }

    obj = {};
    session.outAccount.forEach(item => {
        let d = { name: item.name, op: item.op, time: moment(item.time).format('YYYY-MM-DD HH:mm:ss') };
        if (!obj[item.name]) {
            obj[item.name] = { value: 0 };
        }

        if (!!item.unit) {
            obj[item.name]['value'] += item.value * session.getExchRate();
            d.value = `${session.numFormat(item.value)}u (${session.numFormat(item.value * session.getExchRate())})`;
        } else {
            obj[item.name]['value'] += item.value;
            d.value = `${session.numFormat(item.value)}`;
        }

        data.outList.push(d);
    });

    for (let key in obj) {
        let d = { name: key, value: `${session.numFormat(obj[key].value)}` };
        if (session.isSetExchRate()) {
            d.value = `${d.value} | ${session.numFormat(obj[key].value / session.getExchRate())}u`;
        }
        data.outSummary.push(d);
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