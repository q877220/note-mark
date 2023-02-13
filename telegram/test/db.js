const { db } = require('../utils/database');

async function createTable () {
    try {
        let exists = false;
        exists = await db.schema.hasTable('tb_session_account_detail');
        if (!exists) {
            await db.schema.createTable('tb_session_account_detail', t => {
                t.increments('id').primary();
                t.integer('chat_id'),
                    t.string('name'),
                    t.tinyint('direct').comment('1: in(+); 2:out(-) 3:distribute(下发)'),
                    t.decimal('money'),
                    t.decimal('rate').defaultTo(1),
                    t.string('operator', 32).notNullable(),
                    t.timestamps(true, true)
            });
        }

        exists = await db.schema.hasTable('tb_session_info');
        if (!exists) {
            await db.schema.createTable('tb_session_info', t => {
                t.integer('chat_id').primary(),
                    t.integer('uid').notNullable(),
                    t.string('username'),
                    t.string('first_name', 32),
                    t.string('last_name', 32),
                    t.float('rate').defaultTo(0),
                    t.float('exchange_rate').defaultTo(1),
                    t.string('robot', 32),
                    t.timestamps(true, true)
            });
        }

        exists = await db.schema.hasTable('tb_session_operator');
        if (!exists) {
            await db.schema.createTable('tb_session_operator', t => {
                t.integer('chat_id'),
                    t.integer('uid'),
                    t.string('name').notNullable(),
                    t.boolean('owner').defaultTo(false),
                    t.string('add_by').notNullable(),
                    t.timestamps(true, true),
                    t.primary(['chat_id', 'name'])
            });
        }

        exists = await db.schema.hasTable('tb_chat_user');
        if (!exists) {
            await db.schema.createTable('tb_chat_user', t => {
                t.integer('uid'),
                    t.string('username', 32),
                    t.string('first_name', 32),
                    t.string('last_name', 32),
                    t.integer('role').comment('0: super admin; 1: admin; 2: temporary admin; 99:robot'),
                    t.string('robot', 32),
                    t.datetime('expired'),
                    t.timestamps(true, true),
                    t.primary(['uid', 'robot'])
            });
        }
    } catch (e) {
        console.error(e);
    }
}

async function dropTable (table) {
    try {
        await db.schema.dropTableIfExists(table);
    } catch (e) {
        console.error(e);
    }
}

async function init () {
    try {
        db('tb_chat_user')
            .insert([{ uid: 1553395494, username: "tinycalf", first_name: 'smart', last_name: "tony", role: 0, robot: 'Fsgubl07bot', expired: '2050-01-01 00:00:00' },
            { uid: 1553395494, username: "tinycalf", first_name: 'smart', last_name: "tony", role: 0, robot: 'buGm107bot', expired: '2050-01-01 00:00:00' }])
            .on('query', sql => {
                console.log(sql);
            })
            .onConflict(['uid', 'robot'])
            .ignore()
            .then(data => {
                console.log('=====')
                console.log(data);
            })
            .catch(err => {
                console.log('########')
                console.error(err);
            });
    } catch (e) {
        console.error(e);
    }
}

(async function run () {
    try {
        await createTable();
        // await dropTable('tb_session_account_detail');
        // await dropTable('tb_session_info');
        // await dropTable('tb_session_operator');
        // await dropTable('tb_chat_user');
        // await init();

        // let dRet = await db('tb_session_account_detail').whereRaw(`id = 1`).del(['id', 'chat_id']);
        // console.log(dRet);

        // let records = await select(`(select * from tb_session_account_detail where )`);
        // console.log(records);

        try {
            await db('tb_session_operator')
                .insert({ chat_id: -6980553361, uid: 1553395494, name: '@xiaoyixiao4853', add_by: 'tiny' })
                .on('query', sql => {
                    console.log(sql);
                })
                .then(data => {
                    console.log('=====')
                    console.log(data);
                })
                .catch(err => {
                    console.log('########')
                    console.error(err);
                });
        } catch (e) {
            console.log('-----')
            console.error(e);
        }

        db('tb_session_info')
            .select('*')
            .on('query', sql => {
                console.log(sql);
            })
            .then(data => {
                console.log('=====')
                console.log(data);
            })
            .catch(err => {
                console.log('########')
                console.error(err);
            });

        // db('tb_session_operator')
        //     .insert({ chat_id: -6980553361, uid: 1553395494, name: '@xiaoyixiao4853', add_by: 'tiny' })
        //     .on('query', sql => {
        //         console.log(sql);
        //     })
        //     .onConflict(['chat_id', 'name'])
        //     .ignore()
        //     .then(data => {
        //         console.log('=====')
        //         console.log(data);
        //     })
        //     .catch(err => {
        //         console.log('########')
        //         console.error(err);
        //     });

        // let sql = db('tb_session_operator').where('owner', 3).select('*').then(data => {
        //     console.log(data);
        // });

        // sql = db('tb_session_operator').whereNot('owner', 3).select('*').then(data => {
        //     console.log(data);
        // });

        // sql = db('tb_session_operator').where({ 'owner': false }).andWhere({ role: 1 }).update({
        //     owner: true
        // }).toString();

        // sql = db('tb_session_account_detail').where(1, 1).groupBy('direct').select('*').then(data => {
        //     console.log(data);
        // });

        // console.log(sql);

        // db.select('*')
        //     .from('tb_session_operator')
        //     .where('created_at', '>', '2023-02-08 07:00:00')
        //     .on('query', sql => {
        //         console.log(sql);
        //     }).then(data => {
        //         console.log(data);
        //     }).catch(err => {
        //         console.log('########')
        //         console.error(err);
        //     });


        // db('tb_session_operator').where(function () {
        //     this.where('name', '@xiaoyixiao48532').orWhere('uid', 15533954942);
        // }).on('query', sql => {
        //     console.log(sql);
        // }).del().then(data => {
        //     console.log(data);
        // }).catch(err => {
        //     console.error(err);
        // });


    } catch (e) {
        console.error(e);
    }
})()
