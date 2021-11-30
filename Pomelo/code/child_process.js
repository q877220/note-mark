const {
    spawn
} = require('child_process');
const ls = spawn('sleep', ['30']);

ls.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

ls.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
});

ls.on('close', (code, signal) => {
    console.log(`On close event exited with code:${code}, signal:${signal}`);
});

ls.on('exit', (code, signal ) => {
    console.log(`On exit event exited with code:${code}, signal:${signal}`);
});