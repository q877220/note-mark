const axios = require('axios');

const service = axios.create({
    timeout: 5000
});

service.interceptors.request.use(config => {
    return config;
}, error => {
    console.error(error);
    return Promise.resolve(null);
});

service.interceptors.response.use(
    response => {
        return response.data;
    }, error => {
        console.error(error);
        return Promise.resolve(null);
    });

module.exports = service;

