const moment = require('moment');
const { db } = require('../utils/database');
const ACCOUNT_BEGIN = 4;
async function sessionDetail () {
    try {
        let time = moment().startOf('day').add(ACCOUNT_BEGIN, 'h');
        let accouts = await db('tb_session_account_detail')
            .where({ chat_id: 123 })
            .andWhere('created_at', '>=', moment.utc(time).format('YYYY-MM-DD HH:mm:ss'))
            .orderBy('created_at')
            .select('*')
            .on('query', sql => {
                console.log(sql);
            });
        console.log(accouts);
    } catch (e) {
        console.error(e);
    }
}

sessionDetail();