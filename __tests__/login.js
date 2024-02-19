const supertest = require("supertest");
const r = require("express");
const express = r();
const request = supertest; // Corrected the import name
const db = require("../models/index");
const app = require("../index");
const { describe, beforeAll, afterAll, test, expect } = require("@jest/globals"); // Import describe, beforeAll, afterAll, test, and expect from Jest
const cheerio = require("cheerio");

let server, agent;

function extractCsrfToken(res) {
  const $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, email, password) => {
  let res = await agent.get("/login");
  const csrfToken = extractCsrfToken(res);
  res = await agent
    .post("/login")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send({
      email,
      password,
      _csrf: csrfToken,
    });
};

describe("Login test suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = express.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Log in with valid credentials", async () => {
    // Create a test user
    const userData = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "password123",
    };
    await agent.post("/signup").send(userData);

    // Log in with valid credentials
    await login(agent, userData.email, userData.password);

    // Assert that the response status code is 302 (redirect indicating successful login)
    expect(response.statusCode).toBe(302);
  });

  test("Log in with invalid credentials", async () => {
    // Log in with invalid credentials
    await login(agent, "invalid@example.com", "invalidpassword");

    // Assert that the response status code is 401 (unauthorized)
    expect(response.statusCode).toBe(401);
  });
});
