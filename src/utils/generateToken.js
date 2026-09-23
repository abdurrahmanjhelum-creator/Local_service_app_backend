const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'local_services_jwt_secret_dev_key_12345', {
        expiresIn: '30d' // Token 30 din tak valid rahega
    });
};

module.exports = generateToken;