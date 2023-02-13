const knex = require('knex');
const ApplicationError = require('./error');

const db = knex({
    client: 'sqlite3',
    connection: {
        filename: "./teldb.sqlite"
    },
    useNullAsDefault: true
});

async function insert (table, data, ret_filed = []) {
    try {
        return await db(`${table}`).insert(data, ret_filed);
    } catch (e) {
        throw new ApplicationError(3000, e, { table, data });
    }
}

async function select (sql) {
    try {
        return await db.select('*').fromRaw(`(${sql})`);
    } catch (e) {
        throw new ApplicationError(3000, e, { sql });
    }
}

async function init () {
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
                    t.float('exchange_rate').defaultTo(0),
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
                    t.string('robot', 32),
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
                    t.primary(['uid', 'robot']),
                    t.unique(['uid', 'role'])
            });
        }
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}

init();

module.exports = {
    db,
    select,
    insert
}
