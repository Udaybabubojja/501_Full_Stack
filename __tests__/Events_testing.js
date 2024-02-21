const request = require("supertest");
const db = require("../models/index");
const app = require("../app");
const http = require("http");
const { describe, beforeAll, afterAll, test, expect } = require("@jest/globals"); 
const cheerio = require("cheerio");
let server, agent;
function extractCsrfToken (res) {
  const $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}
const user = {
  email: "user@example.com"
};
describe("Event Organiser Testing", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = http.createServer(app);
    server.listen(4000, () => {});
    agent = request.agent(server);
  });
  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });
  test("Signup with valid User", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/signup").send({
      firstName: "Tests",
      lastName: "User B",
      email: "user@example.com",
      password: "123456",
      isAdmin: true,
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302);
  });

  test("Login with Invalid User", async () => {
    let res = await agent.get("/login");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/login").send({
      email: "user.b@test.com",
      password: "123456",
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302);
  });

  test("Login with Valid User", async () => {
    let res = await agent.get("/login");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/login").send({
      email: "user@example.com",
      password: "123456",
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302);
  });

  test("Valid Events Creation", async () => {
    let res = await agent.get("/events");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/events").send({
      eventName: "Coding",
      maxSize:3,
      description:"This is an Coding Event",
      eventDate:"2024-03-21",
      eventTime:"17:00",
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302); 
    expect(res.headers.location).toBe("/profile");
  });
  test("Render profile page", async () => {
    let res = await agent.get("/profile");
    expect(res.statusCode).toBe(200);
  });
  
  test("Join individual", async () => {
    const eventId = 1;
    let res = await agent.get(`/join?id=${eventId}`);
    const csrfToken = extractCsrfToken(res);
    res = await agent.post(`/join?id=${eventId}`).send({
      name: "user",
      email: "example1@gmail.com",
      phone: "907938",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/home");
  });
  
  test("Join as Team", async () => {
    let res = await agent.get("/joinAsTeam?id=1");
    const csrfToken = extractCsrfToken(res);
  
    res = await agent.post("/submitTeam").send({
      teamName: "Team A",
      eventId: 1,
      memberNames: ["John Doe", "Jane Doe", "Jack"],
      memberEmails: ["john@example.com", "jane@example.com", "jack@example.com"],
      memberPhones: ["1234567890", "0987654321", "974801948"],
      _csrf: csrfToken
    });
  
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/home");
  });

  
  
  // test("Exit from team", async () => {
  //   const teamId = 1;
  //   const res = await agent.post(`/removeEmail/jane@example.com/${teamId}`);
  //   expect(res.statusCode).toBe(302);
  // });
  
  test("Exit from event", async () => {
    let res = await agent.get("/profile");
    const csrfToken = extractCsrfToken(res);
    const userId =1;
    res = await agent.post(`/removeUser/${userId}`).send({
      _csrf: csrfToken
    })
      // Corrected URL format
    expect(res.statusCode).toBe(302);
  });
  
  test("Remove team", async () => {
    let res = await agent.get("/profile");
    const csrfToken = extractCsrfToken(res);
    const teamId = 1;
    res = await agent.post(`/removeTeam/${teamId}`).send({
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302);
  });
  test("Remove event", async () => {
    let res = await agent.get("/profile");
    const csrfToken = extractCsrfToken(res);
    const eventId = 1;
    res = await agent.post(`/removeEvent/${eventId}`).send({
      _csrf: csrfToken
    });
    expect(res.statusCode).toBe(302);
  });
  test("logout", async () => {
    let res = await agent.get("/logout"); // Log the location header
    expect(res.statusCode).toBe(302); // Expect a redirect status code
  });
});