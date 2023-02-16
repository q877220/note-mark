module.exports = {
    //每日账单开始时间
    ACCOUNT_BEGIN: 6,

    //客服人员username
    SERVICE_BOT: '@Xiaokm2022',

    //Chat status
    CHAT_INIT: 0,
    CHAT_START: 1,
    //入账、下发用户名长度
    NAME_SIZE: 4,
    //账单显示记录条数
    LIST_SIZE: 5,
    //欧意购买价格表长度
    SELL_SIZE: 10,
    PAY_METHOD: { lk: 'bank', lz: 'aliPay', lw: 'wxPay', k: 'bank', z: 'aliPay', w: 'wxPay' },
    PAY_NAME: { lk: '银行卡', lz: '支付宝', lw: '微信', k: '银行卡', z: '支付宝', w: '微信' },
}