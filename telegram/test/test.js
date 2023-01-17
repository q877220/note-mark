const _ = require('lodash');
const moment = require('moment');

const NAME_SIZE = 16;

//支持的货币
const currencyType = ['u'];
function getUnit(text) {
    for (let val of currencyType) {
        let ret = text.match(/val/);
        if (ret) {
            return ret[0];
        }
    }
    return null;
}
class ChatSession {
    constructor(bot, id) {
        this.bot = bot;
        this.chatId = id;
        this.status = 0; //0:初始状态; 1:开始;
        this.rate = -1;
        this.exchRate = 0;
        this.inCnt = 0;
        this.outCnt = 0;
        this.inTotal = 0;
        this.outTotal = 0;
        this.inAccount = [];
        this.outAccount = [];
    }

    empty() {
        this.inCnt = 0;
        this.outCnt = 0;
        this.inTotal = 0;
        this.outTotal = 0;
        this.inAccount = [];
        this.outAccount = [];
        this.summary();
    }

    distribute(from, text, unit) {
        let num = parseFloat(text) || 0;
        let data = {
            direct: '-', time: moment().unix(), value: num, unit, op: `${from.first_name} ${from.last_name}`
        };

        this.outCnt++;
        this.outTotal -= !!data.unit ? data.value * this.exchRate : data.value;
        this.outAccount.push(data);
        this.summary();
    }

    parseAccount(type, from, text) {
        let [name, num] = text.split(`${type}`);
        let unit = getUnit(num);
        num = parseFloat(num);
        if (_.isNaN(num)) {
            // bot.sendMessage(msg.chat.id, `金额无效，请重新输入！`);
            return;
        }


        let data = {
            direct: type, time: moment().unix(), value: num, unit, op: `${from.first_name} ${from.last_name}`
        };
        if ('+' === type) {
            data.name = name;
            this.inCnt++;
            this.inTotal += !!data.unit ? data.value * this.exchRate : data.value;
            this.inAccount.push(data);
        } else {
            this.outCnt++;
            this.outTotal -= !!data.unit ? data.value * this.exchRate : data.value;
            this.outAccount.push(data);
        }

    }

    checkin(from, text) {
        this.parseAccount('+', from, text);
        this.summary();
    }

    checkout(from, text) {
        this.parseAccount('-', from, text);
        this.summary();
    }

    summary() {
        debugger;
        let msg = ``;
        let inDetail = this.inAccount.map(item => {
            let n = NAME_SIZE;
            for (let i = 0; i < item.name.length && n > _.floor(NAME_SIZE / 2); i++) {
                if (/[\u4E00-\u9FA5]/.test(item.name[i])) {
                    n--;
                }
            }
            return `${_.pad(item.name, n)} ${moment(item.time * 1000).format('HH:mm:ss')}  ${item.value}`;
        });

        let outDetail = this.outAccount.map(item => {
            let tmp = `${moment(item.time * 1000).format('HH:mm:ss')}  ${item.value}`;
            if (!!item.unit) {
                return `${tmp}${item.unit} (${item.value * this.exchRate})`;
            }
        });

        let obj = {};
        this.inAccount.forEach(item => {
            if (obj[item.name]) {
                obj[item.name] += item.value;
            } else {
                obj[item.name] = item.value;
            }
        });

        let summaryMsg = ``;
        for (let key in obj) {
            summaryMsg = `${summaryMsg}  ${key}总  ${obj[key]}\n`;
        }

        let inCutFeeSum = this.inTotal * (1 - this.rate / 100);
        let outCutFeeSum = this.outTotal * (1 - this.rate / 100);

        //         msg = `<b>入款(${this.inCnt}笔):</b>\n ${inDetail.join('\n')}\n
        // <b>下发(${this.outCnt}笔):</b>\n ${outDetail.join('\n')}\n
        // <b>入款分类</b>\n  ${summaryMsg}\n <b>总入款:</b> ${this.inTotal}
        // <b>费率:</b> ${this.rate}%
        // <b>USD汇率:</b> ${this.exchRate}
        // <b>应下发:</b>  ${inCutFeeSum} | ${_.round(inCutFeeSum / this.exchRate, 2)} USDT
        // <b>总下发:</b>  ${outCutFeeSum} | ${_.round(outCutFeeSum / this.exchRate, 2)} USDT
        // <b>未下发:</b>  ${inCutFeeSum - outCutFeeSum} | ${_.round((inCutFeeSum - outCutFeeSum) / this.exchRate, 2)} USDT`;

        msg = `<b>入款(${this.inCnt}笔):</b>\n${inDetail.join('\n')}\n`;
        msg = `${msg}<b>下发(${this.outCnt}笔):</b>\n ${outDetail.join('\n')}\n`;
        msg = `${msg}<b>入款分类</b>\n  ${summaryMsg}\n<b>总入款:</b> ${this.inTotal}\n`;
        msg = `${msg}<b>费率:</b> ${this.rate}%\n`;
        if (this.exchRate > 0) {
            msg = `${msg}<b>USD汇率:</b> ${this.exchRate}\n`;

        }
        msg = `${msg}<b>应下发:</b>  ${inCutFeeSum} ${this.exchRate <= 0 ? '' : ` | ${_.round(inCutFeeSum / this.exchRate, 2)} USDT`}\n`;
        msg = `${msg}<b>总下发:</b>  ${outCutFeeSum} ${this.exchRate <= 0 ? '' : `| ${_.round(outCutFeeSum / this.exchRate, 2)} USDT`}\n`;
        msg = `${msg}<b>未下发:</b>  ${inCutFeeSum - outCutFeeSum} ${this.exchRate <= 0 ? '' : ` | ${_.round((inCutFeeSum - outCutFeeSum) / this.exchRate, 2)} USDT`}`;


        this.bot.sendMessage(this.chatId, msg, { parse_mode: 'HTML' });
    }
}
const bot = {
    sendMessage: function (...arg) {
        console.log([...arg]);
    }
};

// let chat = new ChatSession(bot, 22);

// chat.checkin({ first_name: 'test' }, '卡1 +1000u');
// // chat.checkin({first_name: 'test'}, '卡2 +5000');
// chat.rate = 10;

let msg = '卡1'
function pad(text, size=16) {
    let n = NAME_SIZE;

    // for (let i = 0; i < text.length && n > _.floor(NAME_SIZE / 2); i++) {
    //     if (/[\u4E00-\u9FA5]/.test(text[i])) {
    //         n--;
    //     }
    // }
        for (let i = 0; i < text.length && n > _.floor(NAME_SIZE / 2); i++) {
            if (/[\u4E00-\u9FA5]/.test(text[i])) {
                n--;
            }
        }

        return _.truncate(_.padEnd(text, n), { length: size });
    console.log(n);
    return n;
}


console.log(`[1${_.padEnd(msg, pad(msg))}]`);
console.log(`[${pad(msg)}]`);
msg = '中国a'
console.log(`[2${_.truncate(_.padEnd(msg, pad(msg)), {length:16})}]`);
console.log(`[${pad(msg)}]`);

msg = `${msg}     lkjkljkjkljlkljlk q j a`
console.log(`[${_.truncate(_.padEnd(msg, pad(msg)), {length:16})}]`);
console.log(`[${pad(msg)}]`);

msg = '中华人民共和国成立了啊啦我他乐山大佛'
console.log(`[2${_.truncate(_.padEnd(msg, pad(msg)), {length:16})}]`);
console.log(`[${pad(msg)}]`);

msg = 'aldflksdfposafewakflkafjlksadf'
console.log(`[2${_.truncate(_.padEnd(msg, pad(msg)), {length:16})}]`);
console.log(`[${pad(msg)}]`);

msg = ' '
console.log(`[${_.truncate(_.padEnd(msg, pad(msg)), {length:16})}]`);
console.log(`[${pad(msg)}]`);


/*
{"message_id":525,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773292,"text":"设置费率10%"}
[message]===>{"message_id":527,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773295,"text":"开始"}
[message]===>{"message_id":529,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773301,"text":"设置汇率6.5"}
[message]===>{"message_id":531,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773308,"text":"卡1   +10000"}
[message]===>{"message_id":533,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773315,"text":"卡2+10000"}
[message]===>{"message_id":535,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773322,"text":"+5000"}
[message]===>{"message_id":537,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773336,"text":"卡卡3+15000"}
[message]===>{"message_id":539,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773363,"text":"下发500u"}
[message]===>{"message_id":541,"from":{"id":1553395494,"is_bot":false,"first_name":"@tinycalf","language_code":"zh-hans"},"chat":{"id":1553395494,"first_name":"@tinycalf","type":"private"},"date":1673773400,"text":"下发3000"}

获取管理员：https://api.telegram.org/bot5933218654:AAEBsQGf3vzBkGWsfk2ZQ2zBreyBvGPIqyw/getChatAdministrators?chat_id=-699194690
*/