const TelegramBot = require('node-telegram-bot-api');
const _ = require('lodash');
const moment = require('moment');
const service = require('./utils');

const token = '5933218654:AAEBsQGf3vzBkGWsfk2ZQ2zBreyBvGPIqyw';

const config = {
    okx: {
        url: `https://www.channelbuy.com/v3/c2c/tradingOrders/books`
    },
    mifeng: {
        url: `https://data.mifengcha.com/api/v3/exchange_rate`,
        token: `3XC68SPQU1MP8GURNV5HIJV8QE0LSZPQTQ7E6JMX`
    }
}

/**
 * 1. 向系统申请机器人（@BotFather）
 * 2. 通过向@BotFather发送  /setprivacy指令，这样机器人可以收取组内所有信息，否则只能读取特定信息
 */

//指令集
let cmdReg = new Map();
cmdReg.set('开始', new RegExp(/^开始$/));
cmdReg.set('清理今日账单', new RegExp(/^清理今日账单$/));
cmdReg.set('显示账单', new RegExp(/^显示账单$/));

cmdReg.set('下发', new RegExp(/下发\s*\d+(u|U)$/));
cmdReg.set('设置费率', new RegExp(/^设置费率\s*\d+(\.\d+)?%$/));
cmdReg.set('设置汇率', new RegExp(/^设置汇率\s*\d+(\.\d+)?$/));
cmdReg.set('+', [new RegExp(/.*\+\d+(\.\d+)?\s?\/\s?\d+(\.\d+)?$/), new RegExp(/.*\+[1-9]\d{0,}$/)]);
cmdReg.set('-', [new RegExp(/.*\-\d+(\.\d+)?\s?\/\s?\d+(\.\d+)?$/), new RegExp(/.*\-[1-9]\d{0,}$/)]);
cmdReg.set('设置操作员', new RegExp(/^设置操作员.+/));
cmdReg.set('删除操作员', new RegExp(/^删除操作员.+/));

// cmdReg.set('r0', new RegExp(/^r0$/));
cmdReg.set('lk', new RegExp(/^lk$/));
cmdReg.set('lz', new RegExp(/^lz$/));
cmdReg.set('lw', new RegExp(/^lw$/));
cmdReg.set('z', new RegExp(/^z\s*\d+$/));
cmdReg.set('w', new RegExp(/^w\s*\d+$/));
cmdReg.set('k', new RegExp(/^k\s*\d+$/));

//入账、下发用户名长度
const NAME_SIZE = 6;
//账单显示记录条数
const LIST_SIZE = 5;
//欧意购买价格表长度
const SELL_SIZE = 10;
const PAY_METHOD = { lk: 'bank', lz: 'aliPay', lw: 'wxPay', k: 'bank', z: 'aliPay', w: 'wxPay' };
const PAY_NAME = { lk: '银行卡', lz: '支付宝', lw: '微信', k: '银行卡', z: '支付宝', w: '微信' };

/**
 * 1. 开始及其它合法命令发送前必须先设置费率；
 * 2. 美元汇率设置为0时不显示；
 */

/**
 * 1. 离开房间消息: {"message_id":1171,"from":{"id":1553395494,"is_bot":false,"first_name":"@tiny2calf","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-699194690,"title":"机器人测试","type":"group","all_members_are_administrators":true},"date":1673940318,"left_chat_participant":{"id":5116797882,"is_bot":false,"first_name":"Xiao∙km","username":"Xiaokm2022","language_code":"zh-hans","is_premium":true},"left_chat_member":{"id":5116797882,"is_bot":false,"first_name":"Xiao∙km","username":"Xiaokm2022","language_code":"zh-hans","is_premium":true}}
 * 2. 加入房间消息: {"message_id":1206,"from":{"id":1553395494,"is_bot":false,"first_name":"@tiny2calf","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-699194690,"title":"机器人测试","type":"group","all_members_are_administrators":true},"date":1673945583,"new_chat_participant":{"id":5933218654,"is_bot":true,"first_name":"Xiaokm测试机器人","username":"Fsgubl07bot"},"new_chat_member":{"id":5933218654,"is_bot":true,"first_name":"Xiaokm测试机器人","username":"Fsgubl07bot"},"new_chat_members":[{"id":5933218654,"is_bot":true,"first_name":"Xiaokm测试机器人","username":"Fsgubl07bot"}]}
 * 3. 设置操作人消息: {"message_id":43,"from":{"id":1553395494,"is_bot":false,"first_name":"@tiny2calf","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-1001291010412,"title":"研究一二","type":"supergroup"},"date":1673945168,"text":"设置操作人 美熟 @xiaoyixiao4853 美熟   hello","entities":[{"offset":6,"length":2,"type":"text_mention","user":{"id":5822033260,"is_bot":false,"first_name":"美熟","last_name":"米"}},{"offset":9,"length":15,"type":"mention"},{"offset":25,"length":2,"type":"text_mention","user":{"id":5822033260,"is_bot":false,"first_name":"美熟","last_name":"米"}}]}
 * 4. 删除操作人消息: 
 * 5. 获取个人信息: {"ok":true,"result":{"id":5933218654,"is_bot":true,"first_name":"Xiaokm\u6d4b\u8bd5\u673a\u5668\u4eba","username":"Fsgubl07bot","can_join_groups":true,"can_read_all_group_messages":true,"supports_inline_queries":false}}
 */

//支持的货币
const currencyType = ['u'];
function getUnit (text) {
    for (let val of currencyType) {
        let ret = text.match(new RegExp(val));
        if (ret) {
            return ret[0];
        }
    }
    return null;
}
class ChatSession {
    constructor(bot, id) {
        this.bot = bot;
        this.id = id;
        this.status = 0; //0:初始状态; 1:开始;
        this.rate = -1;
        this.exchRate = 0;
        this.inCnt = 0;
        this.outCnt = 0;
        this.inTotal = 0;
        this.inEXRTotal = 0;  //通过汇率转换后的总额
        this.outTotal = 0;
        this.outEXRTotal = 0;  //通过汇率转换后的总额
        this.inAccount = [];
        this.outAccount = [];
        this.operators = new Map(); //key: 用户名, value: 对象({level:1(管理员)|2(操作员), utime:timestamp})
        this.billCycle = 48;
        this.addOperators(['tinycalf'], 1);
        setInterval(() => {
            this.empty(this.billCycle * 60 * 60);
        }, this.billCycle * 60 * 60 * 1000);
    }

    isAdministrator (name) {
        name.replace(/@/g, '');
        return !!(this.operators.get(name) && (this.operators.get(name).level === 1));
    }

    isOperator (name) {
        return !!this.operators.get(name);
    }

    sendMessage (msg) {
        this.bot.sendMessage(this.id, msg);
    }

    removeOperators (members) {
        let cnt = 0;
        members.forEach(item => {
            if (this.operators.delete(item)) {
                cnt++;
            }
        })
        this.bot.sendMessage(this.id, `共删除${cnt}位操作员`)
    }

    addOperators (members, level) {
        let msg = `设置完成，`;
        let cnt = 0;
        members.forEach(item => {
            if (this.operators.has(item)) {
                msg += `${item} 已加过，`;
            } else {
                this.operators.set(item, { level, utime: moment().valueOf() });
                cnt++;
            }
        });
        this.bot.sendMessage(this.id, `${msg}共增加${cnt}位操作员`);
    }

    //清空多少秒前的数据
    empty (seconds) {
        if (0 === seconds) {
            this.inCnt = 0;
            this.outCnt = 0;
            this.inTotal = 0;
            this.inEXRTotal = 0;
            this.outTotal = 0;
            this.outEXRTotal = 0;
            this.inAccount = [];
            this.outAccount = [];
        } else {
            const time = moment().valueOf() - seconds * 1000;
            let idx = this.inAccount.lastIndexOf(item => {
                item.time <= time;
            });
            let inDel = this.inAccount.splice(0, idx);
            inDel.forEach(item => {
                this.inCnt--;
                this.inEXRTotal -= item.value / item.exr;
                this.inTotal -= item.value;
            });

            idx = this.outAccount.lastIndexOf(item => {
                item.time <= time;
            });
            let outDel = this.outAccount.splice(0, idx);
            outDel.forEach(item => {
                this.outCnt--;
                this.outEXRTotal -= item.value;
                this.outTotal -= item.value * this.exchRate;
            });
        }

        this.summary();
    }

    distribute (from, text) {
        let { name, num } = text;
        let data = {
            name: name || ' ', time: moment().valueOf(), value: parseFloat(num) || 0, op: `${from.username}` || `${from.first_name} ${from.last_name}`
        };

        this.outCnt++;
        this.outEXRTotal += data.value;
        this.outTotal += data.value * this.exchRate;
        this.outAccount.push(data);
        this.summary();
    }

    parseAccount (type, from, text) {
        let [name, expression] = text.split(`${type}`);
        name = _.trim(name);
        let [num, r] = expression.split('/');
        let value = parseFloat(num);
        if (!r && 0 === this.exchRate) {
            this.bot.sendMessage(this.id, `当前未设置美元汇率\n请使用命令：设置汇率X.XX`);
            return;
        }
        r = parseFloat(r) || this.exchRate;

        let data = {
            name: name || ' ', time: moment().valueOf(), value, exr: r, op: `${from.username}` || `${from.first_name} ${from.last_name}`
        };
        this.inCnt++;

        if ('-' === type) {
            data.value *= -1;
        }

        this.inEXRTotal += data.value / data.exr;
        this.inTotal += data.value;
        this.inAccount.push(data);

        this.summary();
    }

    checkin (from, text) {
        this.parseAccount('+', from, text);
    }

    checkout (from, text) {
        this.parseAccount('-', from, text);
    }

    strFormat (text, size = NAME_SIZE) {
        let n = size;
        for (let i = 0; i < text.length && n > _.floor(NAME_SIZE / 2); i++) {
            if (/[\u4E00-\u9FA5]/.test(text[i])) {
                n--;
            }
        }

        return _.truncate(_.padEnd(text, n), { length: size });
    }

    numFormat (num) {
        let str = num.toString().replace(/(?=(\d{3})+(?!\d))/g, ',');
        if (_.startsWith(str, ',')) {
            str = str.slice(1);
        }
        return str;
    }

    summary () {
        let msg = ``;
        let inTail5 = this.inAccount.slice(-1 * LIST_SIZE);
        let inDetail = inTail5.map(item => {

            let tmp = `<code> ${this.strFormat(item.name)}</code> <code>${moment(item.time).format('HH:mm:ss')}</code>  ${item.value}÷${item.exr}=${_.round(item.value / item.exr, 2)}`;
            if (item.unit) {
                tmp = `${tmp}${item.unit}(${item.value * this.exchRate})`;
            }
            return tmp;
        });

        let outTail5 = this.outAccount.slice(-1 * LIST_SIZE);
        let outDetail = outTail5.map(item => {
            let tmp = `<code> ${this.strFormat(item.name)}</code> <code>${moment(item.time).format('HH:mm:ss')}</code>  ${this.numFormat(item.value)}u`;
            if (item.unit) {
                tmp = `${tmp}${item.unit}(${item.value * this.exchRate})`;
            }
            return tmp;
        });

        let obj = {};
        this.inAccount.forEach(item => {
            if (obj[item.name]) {
                obj[item.name] += item.value;
            } else {
                obj[item.name] = item.value;
            }
        });

        let summaryMsg = ` `;
        for (let key in obj) {
            let label = `${summaryMsg}<code> ${this.strFormat(`${key}总入: `)}</code>`;
            summaryMsg = `${label}  ${this.numFormat(obj[key])}\n`;
        }

        let inCutFeeSum = _.round(this.inEXRTotal * (1 - this.rate / 100), 2);

        msg = `<b>入款(${this.inCnt}笔):</b>\n${inDetail.join('\n')}\n\n`;
        msg = `${msg}<b>入款分类</b>\n${summaryMsg}\n`;
        msg = `${msg}<b>下发(${this.outCnt}笔):</b>\n ${outDetail.join('\n')}\n\n`;
        msg = `${msg}<b>总入款:</b> ${this.numFormat(this.inTotal)}\n`;
        msg = `${msg}<b>费率:</b> ${this.rate}%\n`;
        if (this.exchRate > 0) {
            msg = `${msg}<b>USD汇率:</b> ${this.exchRate}\n`;
        }
        msg = `${msg}<b>应下发:</b>  ${this.numFormat(inCutFeeSum)} USDT\n`;
        msg = `${msg}<b>总下发:</b>  ${this.numFormat(_.round(this.outEXRTotal, 2))} USDT\n`;
        msg = `${msg}<b>未下发:</b>  ${this.numFormat(_.round(inCutFeeSum - this.outEXRTotal, 2))} USDT`;

        let opt = { parse_mode: 'HTML' };
        if (this.inCnt >= LIST_SIZE) {
            let inlineKeyboardMarkup = {};
            inlineKeyboardMarkup.inline_keyboard = [];
            let keyboardRow = [];
            const keyboardButton = {
                text: `点击跳转完整账单`,
                url: `http://119.28.7.237:3001/getBill?c=${this.id}`
            };
            keyboardRow.push(keyboardButton);
            inlineKeyboardMarkup.inline_keyboard.push(keyboardRow);
            opt.reply_markup = inlineKeyboardMarkup;
        }

        this.bot.sendMessage(this.id, msg, opt);
    }
}

class Chat {
    constructor(token) {
        this.bot = new TelegramBot(token, { polling: true });
        this.session = new Map();
        this.listenEvent();
    }

    getChatSession (chat_id) {
        let record = null;
        if (this.session.has(chat_id)) {
            record = this.session.get(chat_id);
        }
        return record;
    }

    listenEvent () {
        this.bot.on('message', msg => {
            console.log(`[message]===>${JSON.stringify(msg)}`);
        })

        this.bot.on('text', async (msg) => {
            let record = null;
            if (this.session.has(msg.chat.id)) {
                record = this.session.get(msg.chat.id);
            } else {
                //TODO: 服务重启后需要加载当前机器人所在所有群的信息
                record = new ChatSession(this.bot, msg.chat.id);
                this.session.set(msg.chat.id, record);
            }

            let txt = _.trim(msg.text);

            for (let [key, reg] of cmdReg) {

                if (_.isArray(reg)) {
                    if (!(['+', '-'].includes(key) && (txt.match(reg[0]) || txt.match(reg[1])))) {
                        continue;
                    }
                } else if (!txt.match(reg)) {
                    continue;
                }
                let name = msg.from.username || msg.from.first_name;

                if (['开始', '设置费率', '设置汇率', '设置操作员', '删除操作员', '清理今日账单'].includes(key)) {
                    if (!record.isAdministrator(name)) {
                        record.sendMessage(`您不是当前权限人哦！请联系管理员。`)
                        return;
                    }
                } else {
                    if (1 !== record.status || (!record.isAdministrator(name) && !record.isOperator(name))) {
                        return;
                    }
                }

                switch (key) {
                    case '开始':
                        if (-1 === record.rate) {
                            record.sendMessage(`请先设置费率`);
                        } else {
                            record.status = 1;
                            record.sendMessage(`机器人开始记录今天账单`);
                        }
                        return;
                    case '清理今日账单':
                        record.empty(0);
                        return;
                    case '显示账单':
                        record.summary();
                        return;
                    case '设置费率':
                        let locReg = new RegExp(`(${key}|%)`, 'g');
                        let rate = parseInt(txt.replace(locReg, ''));
                        if (_.isNaN(rate)) {
                            record.sendMessage(`我想你应该是要设置费率，请发送：设置费率XX%`);
                            return;
                        }
                        record.rate = rate;
                        if (1 === record.status) {  //已发送开始命令，这里是更改
                            record.sendMessage(`更改成功！当前费率为[${rate}%]`);
                        } else {
                            record.sendMessage(`设置成功！当前费率为[${rate}%],接下来发送"开始"就能使用了`);
                        }
                        return;
                    case '设置汇率':
                        let exchRate = parseFloat(txt.replace(new RegExp(`(${key})`, 'g'), ''));
                        if (_.isNaN(exchRate)) {
                            record.sendMessage(`我想你应该是要设置汇率率，请发送：设置汇率XX.XX`);
                            return;
                        }
                        record.exchRate = exchRate;
                        record.sendMessage(`设置成功，当前USD汇率为[${exchRate}]！`);
                        return;
                    case '+':
                        record.checkin(msg.from, txt);
                        return;
                    case '-':
                        record.checkout(msg.from, txt);
                        return;
                    case '下发':
                        let [name, num, tmp] = txt.split(`${key}`);
                        //如果tmp有值则说明用户输入中有多个指令，此种情况不处理
                        if (tmp) {
                            return;
                        }
                        //如果金额后带有单位则转为小写
                        num = _.lowerCase(num);
                        let unit = getUnit(num);
                        if (record.exchRate <= 0 && !!unit) {
                            record.sendMessage(`当前未设置美元汇率\n请使用命令：设置汇率X.XX`);
                        } else {
                            record.distribute(msg.from, { name, num });
                        }
                        return;
                    case '设置操作员':
                        let ctx = txt.replace(new RegExp(`${key}`), '');
                        ctx = ctx.replace(/@/g, '');
                        let members = ctx.split(' ').filter(item => { return !!item; });
                        record.addOperators(members, 2);
                        return;
                    case '删除操作员':
                        let ctx2 = txt.replace(new RegExp(`${key}`), '');
                        ctx2 = ctx2.replace(/@/g, '');
                        let members2 = ctx2.split(' ').filter(item => { return !!item; });
                        record.removeOperators(members2);
                        return;
                    case 'r0':
                        let r = await service({
                            url: config.mifeng.url,
                            headers: { 'X-API-KEY': config.mifeng.token }
                        })
                        if (r) {
                            let realTimeRate = r.find(val => {
                                return val.c === 'CNY';
                            });
                            if (realTimeRate) {
                                record.sendMessage(`当前USD兑人民币汇率为[${realTimeRate.r}]！`);
                            }
                        }
                        return;
                    case 'lk':
                    case 'lz':
                    case 'lw':
                    case 'k':
                    case 'z':
                    case 'w':
                        let list = await service({
                            url: config.okx.url,
                            params: {
                                t: moment().valueOf(),
                                quoteCurrency: 'cny',
                                baseCurrency: 'usdt',
                                side: 'sell',
                                paymentMethod: PAY_METHOD[key],
                                userType: 'all',
                                receivingAds: 'false'
                            },
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
                            }
                        });

                        if (list && list.data) {
                            let min = Infinity;
                            let msg = `当前欧易-${PAY_NAME[key]}USDT购买价`;
                            for (let i = 0; i < list.data.sell.length && i < SELL_SIZE; i++) {
                                min = _.min([parseFloat(list.data.sell[i].price), min]);
                                msg = `${msg}\n买${i + 1}：${list.data.sell[i].price}`;
                            }
                            if (['k', 'z', 'w'].includes(key)) {
                                let ctx2 = txt.replace(new RegExp(`${key}`), '');
                                msg = `${msg}\n\n币数: ${_.trim(ctx2)} / ${min} = ${_.round(parseFloat(ctx2) / min, 2)} USDT`
                            } else {
                                msg = `${msg}\n\n命令:\nlk： 列出银行卡价格\nlz： 列出支付宝价格\nlw： 列出微信价格\n`;
                            }

                            record.sendMessage(msg);
                        }
                        return;
                }
            }
        });

        this.bot.on('chat_join_request', (msg) => {
            console.log(`In chat_join_request EVENT: [${msg}]`)
        });

        this.bot.on('left_chat_member', (msg) => {
            if (this.session.has(msg.chat.id)) {
                let record = this.session.get(msg.chat.id);
                let user = msg.left_chat_member;
                record.removeOperators([user.username || user.first_name]);
            }
        });

        this.bot.on('new_chat_members', async (msg) => {
            console.log(`In new_chat_members EVENT: [${JSON.stringify(msg)}]`)
            let self = await this.bot.getMe();
            if (self.username === msg.new_chat_member.username) {
                let record = new ChatSession(this.bot, msg.chat.id);
                record.addOperators([msg.from.username || msg.from.first_name], 1);
                this.session.set(msg.chat.id, record);
            }
        })

        this.bot.on('polling_error', (error) => {
            console.error(error);
        })
    }


}

module.exports = Chat;