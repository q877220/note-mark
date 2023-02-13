const error = {
    0: 'sucess',
    1000: 'Robot init error',
    1001: 'Paramater invalid',
    2000: 'Bot has exists',
    3000: 'Database error',
    4000: 'Config not found',
    4001: 'Bot not found',

    5000: 'Server inner error'
}
class ApplicationError extends Error {
    constructor(errno, message, options = {}) {
        errno = errno ? errno : 5000;
        const errmsg = error[errno] || 'unknown error';
        super(errmsg);

        this.errno = errno;
        for (const [key, val] of Object.entries(options)) {
            this[key] = val;
        }
        console.error('=========Error Begin========');
        console.error(message);
        console.error(this);
        console.error('=========Error End========');
    }
}

module.exports = ApplicationError;

