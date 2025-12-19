import swaggerJSDoc from "swagger-jsdoc";
import path from "path";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Real-time Chat App",
      version: "1.0.0",
      description: "API documentation for the VideoTube/Chat Backend",
      contact: {
        name: "Archan Acharya",
        email: "archanacharya31@gmail.com",
      },
    },

    servers: [
      {
        url: "http://localhost:8000/api/v1",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/docs/*.ts"]

};

export const swaggerSpec = swaggerJSDoc(options);
