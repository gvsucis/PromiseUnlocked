import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import express from "express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "PromiseUnlocked API",
    version: "1.0.0",
    description: "API documentation for PromiseUnlocked backend",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local server",
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/api/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: express.Application) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
}
