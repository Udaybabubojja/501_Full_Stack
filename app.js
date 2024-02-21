/* eslint-disable no-undef */
// Import necessary modules
const express = require("express");
const app = express();
let cookieParser = require("cookie-parser");
const csrf = require("tiny-csrf");
const path = require("path");
const bodyParser = require("body-parser");
const { Events, Users, Accounts, Teams } = require("./models");
const passport = require("passport");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const connectEnsureLogin = require("connect-ensure-login");
const flash = require("express-flash");
const Sequelize = require("sequelize");
const { Op } = require("sequelize");
// eslint-disable-next-line no-unused-vars
const transporter = require("./mail.js");
app.set("view engine", "ejs");

// Set the views and public directory
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser("Something is there"));
app.use(csrf("abcdefghijklmnopqrstuvwxyz123456", ["PUT", "POST", "DELETE"]));
app.use(flash());

// Passport middleware setup
app.use(
  session({
    secret: "my_secret_key1332141",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (username, password, done) => {
      try {
        const user = await Accounts.findOne({
          where: {
            email: username,
          },
        });

        if (!user) {
          return done(null, false, { message: "Invalid Email" });
        }

        const result = await bcrypt.compare(password, user.password);

        if (result) {
          return done(null, user);
        } else {
          return done(null, false, { message: "Invalid Password" });
        }
      } catch (error) {
        return done(error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await Accounts.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

//about page
app.get("/", async (request, response) => {
  // const user5 = await Events.findByPk(38);
  // console.log(user5);
  // await user5.destroy();
  return response.render("about");
});

// Signup Route
app.get("/signup", (request, response) => {
  return response.render("signup", {
    errors: [],
    csrfToken: request.csrfToken(),
  });
});

app.post("/signup", async (request, response) => {
  try {
    const { firstName, lastName, email, password, isAdmin } = request.body;
    const errors = [];
    if (!firstName || firstName.trim() === "") {
      errors.push({ message: "First Name is required." });
    }
    if (!email || email.trim() === "") {
      errors.push({ message: "Email is required." });
    }
    if (!password || password.trim() === "") {
      errors.push({ message: "Password is required." });
    }
    const existingAccount = await Accounts.findOne({ where: { email } });
    if (existingAccount) {
      errors.push({ message: "An account with this email already exists." });
    }
    if (errors.length > 0) {
      return response.render("signup", {
        errors,
        csrfToken: request.csrfToken(),
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const account = await Accounts.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      isAdmin,
    });
    console.log(account);
    return response.redirect("/login");
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
});

// Login route
app.get("/login", async (request, response) => {
  const a = await request.user;
  console.log(a);
  if (!a)
    response.render("login", {
      errors: request.flash("error"),
      csrfToken: request.csrfToken(),
    });
  else response.redirect("/home");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: true,
  }),
);

//logout
app.get("/logout", (request, response) => {
  request.logout((err) => {
    if (err) {
      return response.status(400).json({ error: "Logout failed" });
    }
    response.redirect("/login");
  });
});

app.get(
  "/home",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      if (!request.user) response.redirect("/login");

      // Delete events with null email (assuming this is how you mark events as expired)
      // await Events.destroy({
      //   where: {
      //     email: null,
      //   },
      // });

      // Fetch all events from the database
      const eventsData = await Events.findAll();

      // Filter out events where the event time has already passed
      const now = new Date();
      const activeEventsData = eventsData.filter((event) => {
        const eventDateTime = new Date(event.date + "T" + event.eventTime);
        return eventDateTime > now;
      });

      // Fetch account details
      const account = await Accounts.findOne({
        where: {
          email: request.user.email,
        },
      });

      return response.render("home", {
        eventsData: activeEventsData,
        user: request.user,
        username: account.firstName,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Events routes
app.get("/events", connectEnsureLogin.ensureLoggedIn(), (request, response) => {
  return response.render("events", {
    errors: [],
    csrfToken: request.csrfToken(),
  });
});

app.post(
  "/events",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const { eventName, maxSize, description, eventDate, eventTime } =
        request.body;
      const errors = [];
      if (!eventName || eventName.trim() === "" || !eventDate || !eventTime) {
        errors.push({
          message: "Event Name or Event Date  or TIme is missing.",
        });
      }
      if (!maxSize || maxSize < 1) {
        errors.push({ message: "Maximum Team Size should be at least 1." });
      }
      if (!description || description.trim() === "") {
        errors.push({ message: "Description is required." });
      }
      const existingEvent = await Events.findOne({
        where: Sequelize.where(
          Sequelize.fn("lower", Sequelize.col("eventName")),
          Sequelize.fn("lower", eventName.trim()),
        ),
      });

      if (existingEvent) {
        errors.push({ message: "Event Name is already exists" });
      }
      if (errors.length > 0) {
        return response.render("events", {
          errors,
          csrfToken: request.csrfToken(),
        });
      }
      const email = request.user.email;
      const name = eventName.trim();
      const event = await Events.create({
        email,
        eventName: name,
        maxSize,
        description,
        date: eventDate,
        eventTime,
      });
      console.log(event);
      response.redirect("/profile");
    } catch (error) {
      console.log("Profile error");
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Join routes
app.get(
  "/join",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const eventId = request.query.id;
      const eventData = await Events.findByPk(eventId);
      console.log(eventData);
      if (!eventData) {
        return response.status(404).render("join", {
          errors: ["Event Not Found"],
          csrfToken: request.csrfToken(),
        });
      }
      return response.render("join", {
        eventData,
        errors: [],
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.post(
  "/join",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const eventId = request.query.id;
      console.log(eventId);
      const eventData = await Events.findByPk(eventId);
      const { name, email, phone } = request.body;
      const errors = [];
      if (!name || name.trim() === "") {
        errors.push({ message: "Name is required." });
      }
      if (!email || email.trim() === "") {
        errors.push({ message: "Email is required." });
      }
      if (!phone || phone.trim() === "") {
        errors.push({ message: "Phone Number is required." });
      }
      const existingUser = await Users.findOne({
        where: {
          eventId,
          email,
        },
      });
      if (existingUser) {
        errors.push({ message: "User with the same email already exists." });
      }
      if (errors.length > 0) {
        return response.render("join", {
          eventData,
          errors,
          csrfToken: request.csrfToken(),
        });
      }
      const user = await Users.create({
        eventId,
        name,
        email,
        phone,
      });
      console.log(user);
      return response.redirect("/home");
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

//join as team routes
app.get("/joinAsTeam", async (request, response) => {
  try {
    const eventId = request.query.id;
    const eventData = await Events.findByPk(eventId);
    console.log(eventData);
    if (!eventData) {
      return response.status(404).render("joinAsTeam", {
        errors: ["Event Not Found"],
        csrfToken: request.csrfToken(),
      });
    }

    return response.render("joinAsTeam", {
      eventData,
      errors: [],
      maxTeamSize: eventData.maxSize,
      csrfToken: request.csrfToken(),
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/submitTeam", async (request, response) => {
  try {
    let errors = [];
    const { teamName, eventId, memberNames, memberEmails, memberPhones } =
      request.body;
    const eventData = await Events.findByPk(eventId);

    if (!teamName || teamName.trim() === "") {
      errors.push({ message: "Team Name is required" });
    }
    if (!eventId) {
      errors.push({ message: "Event ID is required" });
    }
    if (
      !memberNames ||
      !Array.isArray(memberNames) ||
      memberNames.length === 0 ||
      memberNames.every((name) => !name || name.trim() === "")
    ) {
      errors.push({ message: "Member Name(s) cannot be empty" });
    }

    if (
      !memberEmails ||
      !Array.isArray(memberEmails) ||
      memberEmails.length === 0 ||
      memberEmails.every((email) => !email || email.trim() === "")
    ) {
      errors.push({ message: "Member Email(s) cannot be empty" });
    }

    if (
      !memberPhones ||
      !Array.isArray(memberPhones) ||
      memberPhones.length === 0 ||
      memberPhones.every((phone) => !phone || phone.trim() === "")
    ) {
      errors.push({ message: "Member Phone(s) cannot be empty" });
    }

    const lowerCaseTeamName = teamName.toLowerCase();
    const teamExists = await Teams.findOne({
      where: eventId,
      name: Sequelize.where(
        Sequelize.fn("lower", Sequelize.col("name")),
        lowerCaseTeamName,
      ),
    });
    if (teamExists) {
      errors.push({ message: "Team Name already exists" });
    }

    const userExists = await Teams.findOne({
      where: {
        eventId,
        memberEmails: {
          [Op.overlap]: memberEmails,
        },
      },
    });
    if (userExists) {
      errors.push({
        message: "User with the same email already exists for this event",
      });
    }
    const userEmailMatches = await Users.findOne({
      where: {
        eventId,
        email: memberEmails,
      },
    });
    if (userEmailMatches) {
      errors.push({
        message: "User with the same email already exists for this event",
      });
    }

    if (errors.length > 0) {
      return response.render("joinAsTeam", {
        eventData,
        errors,
        maxTeamSize: eventData.maxSize,
        csrfToken: request.csrfToken(),
      });
    }
    const newTeam = await Teams.create({
      name: teamName,
      eventId,
      memberNames,
      memberEmails,
      memberPhones,
    });
    console.log(newTeam);
    response.redirect("/home");
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Internal Server Error" });
  }
});

//profile route
app.get(
  "/profile",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      if (!request.isAuthenticated()) {
        return response.redirect("/login");
      }
      const loggedInUserEmail = request.user.email;

      const userCreatedEvents = await Events.findAll({
        where: {
          email: loggedInUserEmail,
        },
        include: [
          {
            model: Users,
            as: "users", // Assuming the association between Events and Users is defined as 'users'
          },
          {
            model: Teams,
            as: "teams", // Assuming the association between Events and Teams is defined as 'teams'
          },
        ],
      });
      const userJoinedEvents = await Users.findAll({
        where: {
          email: loggedInUserEmail,
        },
        include: [
          {
            model: Events,
            as: "event", // Assuming the association between Users and Events is defined as 'event'
          },
        ],
      });
      const userJoinedTeams = await Teams.findAll({
        where: {
          memberEmails: {
            [Op.contains]: [loggedInUserEmail],
          },
        },
        include: [
          {
            model: Events,
            as: "event", // Assuming the association between Users and Events is defined as 'event'
          },
        ],
      });
      return response.render("profile", {
        userCreatedEvents,
        userJoinedEvents,
        userJoinedTeams,
        email: request.user.email,
        csrfToken: request.csrfToken(),
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

//remove user from the team
app.post(
  "/removeEmail/:email/:teamId",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const removedEmail = request.params.email;
      const teamId = request.params.teamId;
      const team = await Teams.findByPk(teamId);
      if (!team) {
        return response.status(404).json({ error: "Team not found" });
      }
      const memberIndex = team.memberEmails.indexOf(removedEmail);
      if (memberIndex === -1) {
        return response
          .status(404)
          .json({ error: "Email not found in team members" });
      }

      team.memberEmails.splice(memberIndex, 1);
      if (team.memberEmails.length < 2) {
        await team.destroy();
      } else {
        await team.save();
      }
      return response.redirect("/profile");
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

//remove user from the event
app.post(
  "/removeUser/:userId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await Users.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      await user.destroy();
      res.redirect("/profile");
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

//remove team from the event
app.post(
  "/removeTeam/:teamId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const teamId = req.params.teamId;
      const team = await Teams.findByPk(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      await team.destroy();
      res.redirect("/profile");
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// remove event
app.post(
  "/removeEvent/:eventId",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await Events.findByPk(eventId);
      const users = await Users.findAll({ where: { eventId } });
      const teams = await Teams.findAll({ where: { eventId } });
      for (const user of users) {
        await user.destroy();
      }
      for (const team of teams) {
        await team.destroy();
      }
      await event.destroy();
      res.redirect("/profile");
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

module.exports = app;
