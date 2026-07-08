const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "User Authentication API",
            version: "1.0.0",
            description: "API Documentation using Swagger",
        },
        servers: [
            {
                url: "http://localhost:5000",
                description: "Local Server",
            },
        ],
    },

    // Đường dẫn chứa các Route có JSDoc
    apis: ["./src/modules/**/*.routes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;