const TelegramBot = require('node-telegram-bot-api');
const _ = require('lodash');
const moment = require('moment');
const { db } = require('../utils/database');
const service = require('../utils/tools');

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
cmdReg.set('清理今日账单', new RegExp(/^清理(今日)?(账单|数据)$/));
cmdReg.set('显示账单', new RegExp(/^显示账单$/));

cmdReg.set('下发', new RegExp(/下发\s*\d+(u|U)?$/));
cmdReg.set('设置费率', new RegExp(/^设置费率\s*\d+(\.\d+)?%$/));
cmdReg.set('设置汇率', new RegExp(/^设置汇率\s*\d+(\.\d+)?$/));
cmdReg.set('+', [new RegExp(/.*入款\s*\+\d{1,}$/), new RegExp(/.*\+\d{1,}$/)]);
cmdReg.set('-', [new RegExp(/.*入款\s*-\d{1,}$/), new RegExp(/.*-\d{1,}$/)]);
cmdReg.set('设置操作员', new RegExp(/^设置操作[员|人].+/));
cmdReg.set('删除操作员', new RegExp(/^删除操作[员|人].+/));
cmdReg.set('显示操作员', new RegExp(/^显示操作[员|人]$/));
cmdReg.set('结束记录', new RegExp(/^结束记录$/));

// cmdReg.set('r0', new RegExp(/^r0$/));
cmdReg.set('lk', new RegExp(/^lk$/));
cmdReg.set('lz', new RegExp(/^lz$/));
cmdReg.set('lw', new RegExp(/^lw$/));
cmdReg.set('z', new RegExp(/^z\s*\d+$/));
cmdReg.set('w', new RegExp(/^w\s*\d+$/));
cmdReg.set('k', new RegExp(/^k\s*\d+$/));

//每日账单开始时间
const ACCOUNT_BEGIN = 6;

//客服人员username
const SERVICE_BOT = '@Xiaokm2022';

//Chat status
const CHAT_INIT = 0;
const CHAT_START = 1;
//入账、下发用户名长度
const NAME_SIZE = 4;
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
        this.rate = 0;
        this.rateSetStatus = false;
        this.exchRate = 0;
        this.inCnt = 0;
        this.outCnt = 0;
        this.inTotal = 0;
        this.outTotal = 0;
        this.inAccount = [];
        this.outAccount = [];
        this.operators = new Map(); //key: 用户名, value: 对象({ctime:timestamp})
        this.owner = null;
        this.flushData(5 * 60);
    }

    //清理内存中凌晨四点前的所有数据
    flushData (seconds) {
        setInterval(() => {
            let base = moment().startOf('day').add(ACCOUNT_BEGIN, 'h').valueOf();
            let start = base - (seconds + 1) * 1000;
            let end = base + (seconds + 1) * 1000;

            if (moment().isBetween(start, end)) {
                this.setStatus(0);
                this.empty(base);
            }
        }, seconds * 1000)
    }

    //用于启动时初始化操作人
    resetOperator (operators) {
        operators.forEach(item => {
            let ctime = moment(item.created_at).add(8, 'h').valueOf();
            this.operators.set(item.name, { ctime });
        })
    }

    //用于启动时加载账单明细数据
    resetAccount (data, type = 1) {
        let { cnt, total, lists } = data;
        if (1 === type) { //入账
            this.inCnt = cnt;
            this.inTotal = total;
            lists.forEach(item => {
                this.inAccount.push(item);
            })
        } else if (2 === type) { //下发
            this.outCnt = cnt;
            this.outTotal = total;
            lists.forEach(item => {
                this.outAccount.push(item);
            })
        }
    }

    isSetRate () {
        return this.rateSetStatus;
    }

    setStatus (status) {
        this.status = status;
    }

    isWorking () {
        return this.status === 1
    }

    setRate (rate, flag = true) {
        this.rate = rate;
        this.rateSetStatus = true;
        if (flag) {
            db('tb_session_info')
                .where({ chat_id: this.id })
                .on('query', sql => {
                    console.log(sql);
                })
                .update({ rate })
                .catch(err => {
                    console.error(err);
                });
        }

    }

    getRate () {
        return this.rate;
    }

    setExchRate (exchRate, flag = true) {
        this.exchRate = exchRate;
        if (flag) {
            db('tb_session_info')
                .where({ chat_id: this.id })
                .on('query', sql => {
                    console.log(sql);
                })
                .update({ exchange_rate: exchRate })
                .catch(err => {
                    console.error(err);
                });
        }

    }

    isSetExchRate () {
        return this.exchRate > 0;
    }

    getExchRate () {
        return this.exchRate || 1;
    }

    setOwner (user) {
        this.owner = user;
    }

    getOwner () {
        return this.owner;
    }

    getOperators () {
        let members = [];
        this.operators.forEach((val, key) => {
            members.push(key);
        });

        return members;
    }

    removeOperators (members, verbose = true) {
        let cnt = 0;
        members.forEach(item => {
            if (this.operators.delete(item)) {
                db('tb_session_operator')
                    .where({
                        name: item
                    }).on('query', sql => {
                        console.log(sql);
                    }).del().catch(err => {
                        console.error(err);
                    });
                cnt++;
            }
        })
        if (verbose) {
            this.bot.sendMessage(this.id, `共删除${cnt}位操作员`);
        }
    }

    isOperator (name) {
        return !!this.operators.has(name);
    }

    addOperators (members, opts) {
        let msg = `设置完成，`;
        let cnt = 0;
        members.forEach(item => {
            if (this.operators.has(item.name)) {
                msg += `${item.name} 已加过，`;
            } else {
                this.operators.set(item.name, { ctime: moment().valueOf() });
                db('tb_session_operator')
                    .insert({ chat_id: opts.chat_id, uid: item.uid, name: item.name, add_by: opts.add_by })
                    .on('query', sql => {
                        console.log(sql);
                    })
                    .onConflict(['chat_id', 'name'])
                    .ignore()
                    .catch(err => {
                        if (!(err.code && 'SQLITE_CONSTRAINT' === err.code)) {
                            console.error(e);
                        }
                    });
                console.info(`user: [${item.name}] add sucess`);
                cnt++;
            }
        });

        this.bot.sendMessage(this.id, `${msg}共增加${cnt}位操作员`);
    }

    sendMessage (msg) {
        this.bot.sendMessage(this.id, msg);
    }

    empty (time) {
        if (0 === time) {
            this.inCnt = 0;
            this.outCnt = 0;
            this.inTotal = 0;
            this.outTotal = 0;
            this.inAccount = [];
            this.outAccount = [];
            this.sendMessage(`清理成功`);
        } else {
            let inDel = _.remove(this.inAccount, item => {
                return item.time < time;
            });
            inDel.forEach(item => {
                this.inCnt--;
                this.inTotal -= item.value;
            });

            let outDel = _.remove(this.outAccount, item => {
                return item.time < time;
            });
            outDel.forEach(item => {
                this.outCnt--;
                this.outTotal -= item.value * this.getExchRate();
            });
        }
    }

    distribute (from, text, unit) {
        let { name, num } = text;
        let data = {
            name: name || ' ', time: moment().valueOf(), unit, value: parseFloat(num) || 0, op: `${from.username}` || `${from.first_name} ${from.last_name}`
        };

        let detail = { chat_id: this.id, name, direct: 3, money: data.value, operator: `${from.username}` || `${from.first_name} ${from.last_name}` }
        this.outCnt++;
        if (!!unit) {
            this.outTotal += data.value * this.getExchRate();
            detail.rate = this.getExchRate();
        } else {
            this.outTotal += data.value;
        }

        this.outAccount.push(data);
        db('tb_session_account_detail')
            .insert(detail)
            .on('query', sql => {
                console.log(sql);
            }).catch(err => {
                console.error(err);
            });
        this.summary();
    }

    parseAccount (type, from, text) {
        let [name, num] = text.split(`${type}`);
        let value = parseFloat(num);

        name = _.trim(name);
        if (new RegExp(/.*入款$/).test(name)) {
            name = name.replace(/入款$/g, '');
        }
        name = _.trim(name);
        let data = {
            name: name || ' ', time: moment().valueOf(), value, op: `${from.username}` || `${from.first_name} ${from.last_name}`
        };
        this.inCnt++;

        if ('-' === type) {
            data.value *= -1;
        }

        this.inTotal += data.value;
        this.inAccount.push(data);

        db('tb_session_account_detail')
            .insert({ chat_id: this.id, name, direct: '+' === type ? 1 : 2, money: data.value, operator: `${from.username}` || `${from.first_name} ${from.last_name}` })
            .on('query', sql => {
                console.log(sql);
            }).catch(err => {
                console.error(err);
            });

        this.summary();
    }

    record (from, text, type) {
        this.parseAccount(type, from, text);
    }

    strFormat (text, size = NAME_SIZE) {
        // let n = 0;
        // for (let i = 0; i < text.length; i++) {
        //判断字符串中的汉字
        //     if (/[\u4E00-\u9FA5]/.test(text[i])) {
        //         n++;
        //     }
        // }
        return _.truncate(_.padEnd(text, size), { length: size });
    }

    numFormat (num) {
        num = _.round(num, 2);
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
            return ` ${this.strFormat(item.name)} <code>${moment(item.time).format('HH:mm:ss')}</code> ${item.value}`;
        });

        let outTail5 = this.outAccount.slice(-1 * LIST_SIZE);
        let outDetail = outTail5.map(item => {
            let tmp = ` ${this.strFormat(item.name)} <code>${moment(item.time).format('HH:mm:ss')}</code> ${this.numFormat(item.value)}`;
            if (item.unit) {
                tmp = `${tmp}${item.unit} | (${this.numFormat(_.round(item.value * this.getExchRate(), 2))})`;
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

        let summaryMsg = ``;
        for (let key in obj) {
            let label = `${summaryMsg}<code> ${this.strFormat(`${key}`)}</code>总入 :`;
            summaryMsg = `${label}  ${this.numFormat(obj[key])}\n`;
        }

        let inCutFeeSum = _.round(this.inTotal * (1 - this.rate / 100), 2);

        msg = `<b>入款(${this.inCnt}笔) :</b>\n${inDetail.join('\n')}\n\n`;
        msg = `${msg}<b>入款分类</b>\n${summaryMsg}\n`;
        msg = `${msg}<b>下发(${this.outCnt}笔) :</b>\n${outDetail.join('\n')}\n\n`;
        msg = `${msg}<b>总入款 :</b> ${this.numFormat(this.inTotal)}\n`;
        msg = `${msg}<b>费  率 :</b> ${this.rate}%\n`;
        if (this.isSetExchRate()) {
            msg = `${msg}<b>USD汇率 :</b>  ${this.getExchRate()}\n`;
            msg = `${msg}<b>应下发 :</b>  ${this.numFormat(inCutFeeSum)} | ${this.numFormat(_.round(inCutFeeSum / this.getExchRate(), 2))}USDT\n`;
            msg = `${msg}<b>总下发 :</b>  ${this.numFormat(_.round(this.outTotal, 2))} | ${this.numFormat(_.round(this.outTotal / this.getExchRate(), 2))}USDT\n`;
            msg = `${msg}<b>未下发 :</b>  ${this.numFormat(_.round(inCutFeeSum - this.outTotal, 2))} | ${this.numFormat(_.round((inCutFeeSum - this.outTotal) / this.getExchRate(), 2))}USDT`;
        } else {
            msg = `${msg}<b>应下发 :</b>  ${this.numFormat(inCutFeeSum)}\n`;
            msg = `${msg}<b>总下发 :</b>  ${this.numFormat(_.round(this.outTotal, 2))}\n`;
            msg = `${msg}<b>未下发 :</b>  ${this.numFormat(_.round(inCutFeeSum - this.outTotal, 2))}`;
        }


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
    constructor(token, name) {
        this.bot = new TelegramBot(token, { polling: true });
        this.name = name;
        this.sessions = new Map();
        this.administrators = new Map();
        this.status = CHAT_INIT;
        this.init();
        this.listenEvent();
        this.listenKeyBoardEvent();
    }

    async init () {
        try {
            let botName = this.name;
            let admins = await db('tb_chat_user')
                .where(function () {
                    this.where('robot', botName).andWhere('role', '!=', 99)
                }).select('*');

            admins.forEach(item => {
                item.expired = moment(item.expired).format('YYYY-MM-DD HH:mm:ss');
                this.addAdministrator(item, false);
            });

            let sInfo = await db('tb_session_info')
                .where({ robot: this.name })
                .select('*');

            for (let val of sInfo) {
                let { chat_id, uid, username, first_name, last_name, rate, exchange_rate } = val;
                let tmpSession = new ChatSession(this.bot, chat_id);
                tmpSession.setOwner({ uid, first_name, last_name, username });
                tmpSession.setRate(rate, false);
                tmpSession.setExchRate(exchange_rate, false);

                //加载操作员信息
                let operators = await db('tb_session_operator')
                    .where({ chat_id })
                    .andWhere('owner', '!=', 1)
                    .select('*');

                tmpSession.resetOperator(operators);

                //加载账务明细
                let time = moment().startOf('day').add(ACCOUNT_BEGIN, 'h'); // 当地时区凌晨4点
                let accouts = await db('tb_session_account_detail')
                    .where({ chat_id })
                    .andWhere('created_at', '>=', moment.utc(time).format('YYYY-MM-DD HH:mm:ss'))
                    .orderBy('created_at')
                    .select('*');

                let inAcc = [];
                let outAcc = [];
                let inCnt = 0, inTotal = 0;
                let outCnt = 0, outTotal = 0;
                accouts.forEach(acc => {
                    let { name, direct, money, rate, operator, created_at } = acc;
                    switch (direct) {
                        case 1:
                        case 2:
                            inAcc.push({ name: name || ' ', time: moment(created_at).add(8, 'h').valueOf(), value: money, op: operator })
                            inCnt++;
                            if (2 === direct) {
                                money *= -1;
                            }
                            inTotal += money;
                            break;
                        case 3:
                            outAcc.push({ name: name || ' ', time: moment(created_at).add(8, 'h').valueOf(), unit: rate !== 1, value: money, op: operator })
                            outCnt++;
                            if (2 === direct) {
                                money *= -1;
                            }
                            outTotal += money;
                            break;
                    }
                });
                if (0 < inAcc.length) {
                    tmpSession.resetAccount({ cnt: inCnt, lists: inAcc, total: inTotal });
                }
                if (0 < outAcc.length) {
                    tmpSession.resetAccount({ cnt: outCnt, lists: outAcc, total: outTotal }, 2);
                }

                tmpSession.setStatus(1);

                this.sessions.set(chat_id, tmpSession);

                this.status = CHAT_START;
            }
        } catch (e) {
            console.error('======In Bot Init======');
            console.error(e);
        }
    }
    /**
     * 
     * @param {*} uid 
     * @param {*} time 
     * @param {*} expired true: 则time为日期; false: time单位为小时
     * @returns 
     */
    setExpired (uid, time, expired = false) {
        let admin = this.administrators.get(uid);
        if (admin) {
            if (expired) {
                admin.expired = moment().isSameOrAfter(moment(admin.expired)) ? moment(time).valueOf() : moment(admin.expired).add(hour, 'h').valueOf();
            } else {
                admin.expired = moment().isSameOrAfter(moment(admin.expired)) ? moment().add(time, 'h').valueOf() : moment(admin.expired).add(time, 'h').valueOf();
            }

            db('tb_chat_user')
                .where({ uid })
                .update({ expired: moment(admin.expired).format('YYYY-MM-DD HH:mm:ss') })
                .on('query', sql => {
                    console.log(sql);
                })
                .catch(err => {
                    console.log('####In add admin####')
                    console.error(err);
                });

            return admin.expired;
        } else {
            return -1;
        }
    }

    removeAdministrator (uid) {
        if (this.administrators.has(uid)) {
            this.administrators.delete(uid);
            console.info(`Remove administrtor [${uid}] from ${this.name}`);
            db('tb_chat_user')
                .where({ uid })
                .andWhere({ robot: this.name })
                .on('query', sql => {
                    console.log(sql);
                })
                .del()
                .catch(err => {
                    console.log('####In remove admin####');
                    console.error(err);
                });
        }
    }

    isAdministrator (id, tmp_chat_owner_id) {
        let user = this.administrators.get(id);
        //如果robot在调用阶段拉进群，则管理员只能是拉机器人进群的人
        return tmp_chat_owner_id ? id === tmp_chat_owner_id : !!(user && user.role !== 2);
    }

    getSuperAdmin () {
        //付费用户为超级用户
        let user = null;
        for (let val of this.administrators.values()) {
            if (val.role === 0) {
                return val;
            }
        }
    }

    isExpired (id) {
        return this.administrators.get(id).expired <= moment().valueOf();
    }

    addAdministrator (user, type = true) {
        let { uid, username, first_name, last_name, role, expired } = user;
        console.info(`===addAdministrator in [${this.name}]<-[${uid}]===`);
        if (!uid) {
            console.error(`[${uid} invalid]`);
            return;
        }
        this.administrators.set(uid, { uid, username, first_name, last_name, role, ctime: moment().valueOf(), expired: moment(expired).valueOf() });

        if (type) {
            db('tb_chat_user')
                .insert({ uid, role, username, first_name, last_name, robot: this.name, expired })
                .onConflict(['uid', 'robot'])
                .merge(['expired', 'role', 'updated_at'])
                .on('query', sql => {
                    console.log(sql);
                })
                .catch(err => {
                    console.log('####In add admin####')
                    console.error(err);
                });
        }
    }

    judgmentAuth (super_id, id, flag = false) {
        let ret = 0;
        if (this.isExpired(super_id)) {
            ret = 1;
            return ret;
        }

        if (!this.isAdministrator(id, flag ? super_id : undefined)) {
            ret = 2;
            return ret;
        }

        if (this.isAdministrator(id) && this.isExpired(id)) {
            ret = 3;
            return ret;
        }


        return ret;
    }

    getChatSessionByChat (chat_id) {
        return this.sessions.get(chat_id);
    }

    async getChatSession (msg) {
        let session = null;
        if (this.sessions.has(msg.chat.id)) {
            session = this.sessions.get(msg.chat.id);
        } else {
            if (this.status !== CHAT_START) {
                console.info(`Chat unstarted, msg just ignore!!!`);
                return;
            }
            await this.init();

            if ('private' === msg.chat.type) {
                let cs = new ChatSession(this.bot, msg.chat.id);
                let { id: uid, username, first_name, last_name } = msg.from;
                cs.setOwner({ uid, username, first_name, last_name });
                this.sessions.set(msg.chat.id, cs);
                db('tb_session_operator')
                    .insert({ chat_id: msg.chat.id, uid, name: username || `${first_name} ${last_name}`, owner: true, add_by: uid })
                    .on('query', sql => {
                        console.log(`Private chat init ==> [${sql}]`);
                    })
                    .onConflict(['chat_id', 'name'])
                    .ignore()
                    .catch(e => {
                        console.error(e);
                    });

                db('tb_session_info')
                    .insert({ chat_id: msg.chat.id, uid, type: msg.chat.type, username, first_name, last_name, robot: this.name })
                    .on('query', sql => {
                        console.log(sql);
                    })
                    .onConflict('chat_id')
                    .ignore()
                    .catch(e => {
                        console.error(e);
                    });
            }
        }
        return session;
    }

    listenKeyBoardEvent () {
        this.bot.onText(/\/start$/, msg => {
            let ctx = `我是记账机器人\n更多版本请<a href="xxx.baidu.com">查看主页</a>`

            let opts = { parse_mode: 'HTML', reply_markup: {} };
            let keyboardRow = [];
            keyboardRow.push({
                text: `点击这里把机器人加进群`,
                url: `https://t.me/${this.name}?startgroup=spaceship`
            });
            let keyboardRow2 = [];
            keyboardRow2.push({
                text: `点击试用6小时`,
                callback_data: `试用`
            });
            opts.reply_markup.inline_keyboard = [keyboardRow, keyboardRow2];
            this.bot.sendMessage(msg.chat.id, ctx, opts);

            let keyList = [];
            keyList.push(['试用', '开始', '到期时间']);
            keyList.push(['详细说明书', '自助续费']);
            keyList.push(['如何设置权限人', '如何设置群内操作人']);
            opts = { parse_mode: 'HTML', reply_markup: {} };
            opts.reply_markup.keyboard = keyList;
            this.bot.sendMessage(msg.chat.id, '--', opts);
        });

        function trialProduct (instance, msg) {
            let ctx = ``;
            let user = instance.administrators.get(msg.from.id);
            if (user) {
                ctx = `你已有权限啦，结束时间：${moment(user.expired).format('YYYY-MM-DD HH:mm:ss')}`
            } else {
                let { id, username, first_name, last_name } = msg.from;
                let user = { uid: id, username, first_name, last_name, role: 2, expired: moment().add(6, 'h').format('YYYY-MM-DD HH:mm:ss') };
                instance.addAdministrator(user);
                ctx = `申请成功！\n`;
                ctx = `${ctx}使用说明：\n`;
                ctx = `${ctx}1.增加机器人@${instance.name} 进群;\n2.输入: 设置费率X.X%\n3.输入: 开始\n\n`;
                ctx = `${ctx}4.其它命令：`;
                ctx = `${ctx}某某某+XXX    入款XXX元\n下发XXX  也可下发XXXu\n显示账单\n设置操作人 @xxxxx    设置群成员，输入@前打个空格，会弹出选择\n\n`;
                ctx = `${ctx}显示USDT价格\n设置汇率6.5    显示美元，汇率可变，隐藏设置为0\n清理今天数据\n\n`;
                ctx = `${ctx}5.如果输入错误，可以用 某某某-XXX  或 下发-XXX，来修正其它功能请用正式版\n\n图解：`;

                const photo = `${__dirname}/../public/picture/shiyong_rate.jpg`;
                instance.bot.sendPhoto(msg.chat.id, photo);
            }
            return ctx;
        }

        this.bot.on('callback_query', msg => {
            let ctx = ``;
            let cmd = msg.data;
            if (cmd === '试用') {
                let ctx = trialProduct(this, msg);
                this.bot.sendMessage(msg.message.chat.id, ctx);
            }

            if (cmd.startsWith('横财一笔')) {
                let money = parseFloat(cmd.replace(/横财一笔/g, ''));
                money -= _.random(0.1, 0.9);
                ctx = `订单已创建！请在2小时内\n支付 ${_.round(money, 2)} USDT\n\n`;
                ctx = `${ctx}trc地址：<code>TJX4m8f3heQjbA7X8AhddLtjVf9VhCJhqB</code>\n\n`;
                ctx = `${ctx}- 注，请务必按指定金额转账，否则无法自动化延期。\n`;
                ctx = `${ctx}- 充值成功后，3分钟后再次查看时间。\n`;
                ctx = `${ctx}- 如充值有问题，请联系 ${SERVICE_BOT} (10:00-0:00)\n`;

                this.bot.editMessageText(ctx, { chat_id: msg.message.chat.id, message_id: msg.message.message_id, parse_mode: 'HTML' });
            }
        })

        this.bot.onText(/^试用$/, msg => {
            let ctx = trialProduct(this, msg);
            this.bot.sendMessage(msg.chat.id, ctx);
        });

        this.bot.onText(/^到期时间$/, msg => {
            let ctx = ``;
            let user = this.administrators.get(msg.from.id);
            if (user) {
                ctx = `你已有权限啦，结束时间：${moment(user.expired).format('YYYY-MM-DD HH:mm:ss')}`
            } else {
                ctx = `你还未有权限啦，可以试用或购买`;
            }

            this.bot.sendMessage(msg.chat.id, ctx);
        });

        this.bot.onText(/^详细说明书$/, msg => {
            let ctx = ``;
            ctx = `①增加机器人@${this.name} 进群。群右上角--Add member-输入@${this.name}\n`;
            ctx = `${ctx}②输入”设置费率X.X%“  或后期可以“更改费率X.X%”\n`;
            ctx = `${ctx}③输入”开始”，每天必须先输入此命令，机器人才会开始记录。默认是每天4点至第二天4点\n\n\n`;
            ctx = `${ctx}④其它命令：\n`;
            ctx = `${ctx}xxxxx+XXX    入款XXX元。 \n下发XXX\n下发XXXu\n`;
            ctx = `${ctx}显示账单   显示最近5条数据。\n`;
            ctx = `${ctx}显示完整账单  出现链接，点击链接显示今天/昨天所有入款数据。\n\n`;
            ctx = `${ctx}设置操作人 @xxxxx @xxxx  设置群成员使用。先打空格再打@，会弹出选择更方便。注：再次设置的话就是新增。\n`;
            ctx = `${ctx}显示操作人\n`;
            ctx = `${ctx}删除操作人 @xxxxx 先输入“删除操作人” 然后空格，再打@，就出来了选择，这样更方便\n\n`;
            ctx = `${ctx}显示USDT价格\n`;
            ctx = `${ctx}设置美元汇率6.5  如需显示美元，可设置这个，汇率可改变，隐藏的话再次设置为0。\n\n`;
            ctx = `${ctx}清理今天数据  慎用，必须由权限人发送命令\n`;
            ctx = `${ctx}结束记录\n\n`;
            ctx = `${ctx}⑤如果输入错误，可以用 xxxx-XXX  或 下发-XXX，来修正`;

            this.bot.sendMessage(msg.chat.id, ctx);
        });

        this.bot.onText(/^自助续费$/, msg => {
            const PRICE = [55, 100, 240];
            let opts = { reply_markup: {} };
            let keyboardRow = [];
            keyboardRow.push({
                text: `15天 (${PRICE[0]}U)`,
                callback_data: `横财一笔 ${PRICE[0]}`
            });
            let keyboardRow2 = [];
            keyboardRow2.push({
                text: `一个月 (${PRICE[1]}U)`,
                callback_data: `横财一笔 ${PRICE[1]}`
            });
            let keyboardRow3 = [];
            keyboardRow3.push({
                text: `三个月 (${PRICE[2]}U)(8折)`,
                callback_data: `横财一笔 ${PRICE[2]}`
            });
            opts.reply_markup.inline_keyboard = [keyboardRow, keyboardRow2, keyboardRow3];
            this.bot.sendMessage(msg.chat.id, `自助续费暂只支持USDT的trc通道`, opts);
        });

        this.bot.onText(/^如何设置权限人$/, msg => {
            let ctx = `@${this.name}\n`;
            ctx = `${ctx}这个你复制给要授权的人，让他点进去，再点一下start(开始)，点击【试用】。`;
            this.bot.sendMessage(msg.chat.id, ctx);
            ctx = `然后点击联系 @Xiaokm2022 ,然后告诉他要授权的名字，给予授权`;
            this.bot.sendMessage(msg.chat.id, ctx);
        });

        this.bot.onText(/^如何设置群内操作人$/, async msg => {
            const photo = `${__dirname}/../public/picture/set_operator.gif`;
            await this.bot.sendPhoto(msg.chat.id, photo);
            let ctx = `群内发：设置操作人 @xxxxx\n先打空格再打@，会弹出选择更方便。`;
            this.bot.sendMessage(msg.chat.id, ctx);
        });
    }

    listenEvent () {
        this.bot.on('message', msg => {
            console.log(`[message]===>${JSON.stringify(msg)}`);
        });

        this.bot.on('text', async (msg) => {
            let session = null;
            let isTmpChat = false;

            let txt = _.trim(msg.text);

            for (let [key, reg] of cmdReg) {
                if (_.isArray(reg)) {
                    if (!(['+', '-'].includes(key) && (txt.match(reg[0]) || txt.match(reg[1])))) {
                        continue;
                    }
                } else if (!txt.match(reg)) {
                    continue;
                }

                session = await this.getChatSession(msg);
                if (!session) {
                    //如果初始化后依然没有记录则需要从群里踢出重新拉进群
                    this.bot.sendMessage(msg.chat.id, `我好像迷路了！！！\n【请把我移出群30秒让我冷静一下，之后再拉进来我就恢复了】`);
                    return;
                }

                let name = msg.from.username ? `${msg.from.username}` : msg.from.first_name;

                //将robot拉入群的人不是管理员
                if (!this.administrators.has(session.getOwner().uid)) {
                    this.bot.sendMessage(msg.chat.id, `你未授权！请联系 ${SERVICE_BOT}`);
                    return;
                }

                //判断是否试用机器人会话(拉机器人进群的人是试用权限)
                isTmpChat = this.administrators.get(session.getOwner().uid).role === 2;
                let sAdmin = null;
                let auth = 0;
                if (isTmpChat) {
                    sAdmin = session.getOwner();
                    auth = this.judgmentAuth(sAdmin.uid, msg.from.id, true);
                } else {
                    sAdmin = this.getSuperAdmin();
                    auth = this.judgmentAuth(sAdmin.uid, msg.from.id);
                }

                if (['开始', '设置费率', '设置汇率', '设置操作员', '删除操作员', '清理今日账单', '显示账单', '显示操作员', '结束记录'].includes(key)) {
                    switch (auth) {
                        case 1:
                            session.sendMessage(`权限人<${sAdmin.username} ${sAdmin.first_name}>已过期！此群机器人由他首次设置`);
                            return;
                        case 2:
                            session.sendMessage(`您不是权限人哦！此群机器人由<${sAdmin.username} ${sAdmin.first_name}>首次设置。`);
                            return;
                        case 3:
                            session.sendMessage(`您的权限结束时间: ${moment(this.administrators.get(msg.from.id).expired).format('YYYY-MM-DD HH:mm:ss')}`);
                            return;
                        default:
                            break;
                    }
                } else {
                    if (!session.isWorking() || (!this.isAdministrator(msg.from.id, isTmpChat ? sAdmin.uid : undefined) && !session.isOperator(name))) {
                        return;
                    }
                }

                switch (key) {
                    case '开始':
                        if (!session.isSetRate()) {
                            session.sendMessage(`请先设置费率，请发送：设置费率XX%`);
                        } else {
                            session.setStatus(1);
                            session.sendMessage(`机器人开始记录今天账单`);
                        }
                        return;
                    case '清理今日账单':
                        session.empty(0);
                        return;
                    case '显示账单':
                        session.summary();
                        return;
                    case '结束记录':
                        session.setStatus(0);
                        session.sendMessage(`机器人休息，结束记录`);
                        return;
                    case '设置费率':
                        let locReg = new RegExp(`(${key}|%)`, 'g');
                        let rate = parseInt(txt.replace(locReg, ''));
                        if (_.isNaN(rate)) {
                            session.sendMessage(`我想你应该是要设置费率，请发送：设置费率XX%`);
                            return;
                        }
                        if (session.isSetRate()) {  //已发送开始命令，这里是更改
                            session.sendMessage(`更改成功！当前费率为[${rate}%]`);
                        } else {
                            session.sendMessage(`设置成功！当前费率为[${rate}%],接下来发送"开始"就能使用了`);
                        }
                        session.setRate(rate);

                        return;
                    case '设置汇率':
                        let exchRate = parseFloat(txt.replace(new RegExp(`(${key})`, 'g'), ''));
                        if (_.isNaN(exchRate)) {
                            session.sendMessage(`我想你应该是要设置汇率率，请发送：设置汇率XX.XX`);
                            return;
                        }
                        session.setExchRate(exchRate);
                        session.sendMessage(`设置成功，当前USD汇率为[${exchRate}]！`);
                        return;
                    case '+':
                        session.record(msg.from, txt, '+');
                        return;
                    case '-':
                        session.record(msg.from, txt, '-');
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
                        if (!session.isSetExchRate() && !!unit) {
                            session.sendMessage(`当前未设置汇率\n请使用命令：设置汇率X.XX`);
                        } else {
                            session.distribute(msg.from, { name, num }, unit);
                        }
                        return;
                    case '设置操作员':
                        let ctx = txt.replace(new RegExp(`${key}`), '');
                        // ctx = ctx.replace(/@/g, '');
                        let members = ctx.split(' ').filter(item => { return !!item && item.startsWith('@') });
                        members = members.map(val => {
                            return { name: val.substring(1) };
                        });
                        if (msg.entities) {
                            msg.entities.forEach(item => {
                                if (item.user) {
                                    members.push({ uid: item.user.id, name: `${item.user.first_name} ${item.user.last_name}` });
                                }
                            })
                        }
                        session.addOperators(members, { chat_id: msg.chat.id, add_by: msg.from.id });
                        return;
                    case '删除操作员':
                        let ctx2 = txt.replace(new RegExp(`${key}`), '');
                        // ctx2 = ctx2.replace(/@/g, '');
                        let members2 = ctx2.split(' ').filter(item => { return !!item && item.startsWith('@') });
                        members2 = members2.map(val => {
                            return val.substring(1);
                        });
                        if (msg.entities) {
                            msg.entities.forEach(item => {
                                if (item.user) {
                                    members2.push(`${item.user.first_name} ${item.user.last_name}`);
                                }
                            })
                        }
                        session.removeOperators(members2);
                        return;
                    case '显示操作员':
                        let echo = `当前操作人:`;
                        if (!session.operators.size) {
                            echo = '操作人为空';
                        }

                        echo = `${echo}${session.getOperators().join(',')}`;
                        session.sendMessage(echo);
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
                                session.sendMessage(`当前USD兑人民币汇率为[${realTimeRate.r}]！`);
                            }
                        }
                        return;
                    case 'lk':
                    case 'lz':
                    case 'lw':
                    case 'k':
                    case 'z':
                    case 'w':
                        let list = null;
                        try {
                            list = await service({
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
                        } catch (e) {
                            console.error(e);
                            return;
                        }

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

                            session.sendMessage(msg);
                        }
                        return;
                }
            }
        });

        /**
         * 消息样例：
         * {"message_id":659,"from":{"id":1553395494,"is_bot":false,"first_name":"smart2","last_name":"tony","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-653334968,"title":"t71","type":"group","all_members_are_administrators":true},"date":1675838225,"left_chat_participant":{"id":1754921641,"is_bot":false,"first_name":"Frieda","last_name":"K."},"left_chat_member":{"id":1754921641,"is_bot":false,"first_name":"Frieda","last_name":"K."}}
         */
        this.bot.on('left_chat_member', async (msg) => {
            if (this.sessions.has(msg.chat.id)) {
                let user = msg.left_chat_member;
                try {
                    let self = await this.bot.getMe();
                    if (self.username === user.username) {
                        db('tb_session_info')
                            .where({ chat_id: msg.chat.id })
                            .on('query', sql => {
                                console.log(sql);
                            })
                            .delete()
                            .catch(e => {
                                console.error(e);
                            });

                        db('tb_session_operator')
                            .where({ chat_id: msg.chat.id })
                            .on('query', sql => {
                                console.log(sql);
                            })
                            .delete()
                            .catch(e => {
                                console.error(e);
                            });
                    }

                    this.sessions.get(msg.chat.id).removeOperators([user.username || `${user.first_name} ${user.last_name}`], false);
                    let { id: uid, username, first_name, last_name } = msg.left_chat_member;
                    await db('tb_session_operator')
                        .where(function () {
                            this.where('name', username || `${first_name} ${last_name}`).orWhere('uid', uid);
                        }).on('query', sql => {
                            console.log(sql);
                        }).delete().catch(e => {
                            console.error(e);
                        });

                } catch (e) {
                    console.error(e);
                }
            }
        });

        /**
         * 创建群时加入机器人
         * {"message_id":616,"from":{"id":1553395494,"is_bot":false,"first_name":"smart","last_name":"tony","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-698055336,"title":"t7","type":"group","all_members_are_administrators":true},"date":1675778753,"group_chat_created":true}
         */
        this.bot.on('group_chat_created', async (msg) => {
            console.log(`In group_chat_created EVENT: [${JSON.stringify(msg)}]`);
            let session = new ChatSession(this.bot, msg.chat.id);
            let { id: uid, username, first_name, last_name } = msg.from;
            session.setOwner({ uid, username, first_name, last_name });
            this.sessions.set(msg.chat.id, session);
            session.sendMessage(`感谢您把我添加到贵群!\n通过以下两步即可开始记账:\n1. 设置费率XX%\n2. 开始`);
            db('tb_session_operator')
                .insert({ chat_id: msg.chat.id, uid, name: username || `${first_name} ${last_name}`, owner: true, add_by: uid })
                .on('query', sql => {
                    console.log(`Bot join group ==> [${sql}]`);
                })
                .onConflict(['chat_id', 'name'])
                .ignore()
                .catch(e => {
                    console.error(e);
                });

            //添加机器人信息
            try {
                let self = await this.bot.getMe();

                db('tb_chat_user')
                    .insert({ uid: self.id, role: 99, username: self.username, first_name: self.first_name, last_name: self.last_name })
                    .on('query', sql => {
                        console.log(sql);
                    })
                    .onConflict(['uid', 'role'])
                    .ignore().catch(err => {
                        console.log('####In add admin####')
                        console.error(err);
                    });

                db('tb_session_info')
                    .insert({ chat_id: msg.chat.id, type: msg.chat.type, uid, username, first_name, last_name, robot: self.username })
                    .on('query', sql => {
                        console.log(sql);
                    })
                    .onConflict('chat_id')
                    .ignore()
                    .catch(e => {
                        console.error(e);
                    });
            } catch (e) {
                console.error(e);
            }
        })

        /**
         * 拉机器人进群消息：（同时拉多人进群时，每个人都有一条独立的信息）
         * {"message_id":398,"from":{"id":1553395494,"is_bot":false,"first_name":"smart","last_name":"tony","username":"tinycalf","language_code":"zh-hans"},"chat":{"id":-873630183,"title":"t23","type":"group","all_members_are_administrators":true},"date":1675385473,"new_chat_participant":{"id":5126544932,"is_bot":true,"first_name":"自动统计机器人H5","username":"SmartBillH5_bot"},"new_chat_member":{"id":5126544932,"is_bot":true,"first_name":"自动统计机器人H5","username":"SmartBillH5_bot"},"new_chat_members":[{"id":5126544932,"is_bot":true,"first_name":"自动统计机器人H5","username":"SmartBillH5_bot"}]}
         */
        this.bot.on('new_chat_members', async (msg) => {
            console.log(`In new_chat_members EVENT: [${JSON.stringify(msg)}]`)
            try {
                let self = await this.bot.getMe();
                if (self.username === msg.new_chat_member.username) {
                    let session = new ChatSession(this.bot, msg.chat.id);
                    let { id: uid, username, first_name, last_name } = msg.from;
                    session.setOwner({ uid, username, first_name, last_name });
                    this.sessions.set(msg.chat.id, session);
                    session.sendMessage(`感谢您把我添加到贵群!\n通过以下两步即可开始记账:\n1. 设置费率XX%\n2. 开始`);
                    db('tb_session_info')
                        .insert({ chat_id: msg.chat.id, type: msg.chat.type, uid, username, first_name, last_name, robot: self.username })
                        .on('query', sql => {
                            console.log(sql);
                        })
                        .onConflict('chat_id')
                        .ignore()
                        .catch(e => {
                            console.error(e);
                        })
                    //添加会话创建者
                    db('tb_session_operator')
                        .insert({ chat_id: msg.chat.id, uid, name: username || `${first_name} ${last_name}`, owner: true, add_by: uid })
                        .on('query', sql => {
                            console.log(`Bot join group ==> [${sql}]`);
                        })
                        .onConflict(['chat_id', 'name'])
                        .ignore()
                        .catch(e => {
                            if (!(err.code && 'SQLITE_CONSTRAINT' === err.code)) {
                                console.error(e);
                            }
                        });
                    //添加机器人信息
                    db('tb_chat_user')
                        .insert(
                            { uid: self.id, role: 99, username: self.username, first_name: self.first_name, last_name: self.last_name })
                        .on('query', sql => {
                            console.log(sql);
                        })
                        .onConflict(['uid', 'role'])
                        .ignore()
                        .catch(err => {
                            console.log('####In add admin####')
                            console.error(err);
                        });
                }
            } catch (e) {
                console.error(e);
            }
        })

        this.bot.on('polling_error', (error) => {
            console.error(error);
        })

        this.bot.on('error', (error) => {
            console.error(`In error ==> `);
            console.error(error);
        })

        // const EVENTS = ['new_chat_members', 'left_chat_member', 'group_chat_created', 'chat_member', 'my_chat_member'];

        // EVENTS.forEach(evt => {
        //     this.bot.on(evt, msg => {
        //         console.log(`In ${evt}: ${JSON.stringify(msg)}`);
        //     })
        // })
    }
}

module.exports = Chat;