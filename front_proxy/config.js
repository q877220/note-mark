module.exports = {
  port: 3000,
  login: `http://xynmmj.test.com/login/dlaf911cc79debcb029c3c`,
  user: {
    username: 123456,
    password: '123456',
  },
  proxy: [{
    path: ["/activity/","/admin/","/aliData/","/ayGroupRelate/","/blGroupRelate/","/cardShare/","/coinMatch/","/contest/","/coupon/","/cps/","/crmStatices/","/currency/","/customerData/","/gameItem/","/GameLogScan/","/gameRecord/","/gdRebate/","/growth/","/growthV2/","/guild/","/internal/","/joint/","/kaijieCallback/","/kwxRebate/","/login/","/match/","/memberData/","/newKpi/","/newMember/","/newPay/","/newPlayer/","/online/","/player/","/rebate/","/redisData/","/remoteCoin/","/statStatices/","/switch/","/test/","/tools/","/unionCallback/","/userConsumption/","/userData/","/whiteList/","/wxData/","/wxGroupRelate/","/xlGroupRelate/"],
    target: 'http://10.1.6.94', // 后台服务器地址
  }, ],
  html: 'http://localhost:3030', // 前端本地服务
  frontPage: true,
};