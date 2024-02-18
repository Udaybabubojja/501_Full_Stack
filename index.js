// Import necessary modules
const express = require("express");
const app = express();
let cookieParser = require("cookie-parser");
const path = require("path");
const bodyParser = require("body-parser");
const { Events, Users, Accounts, Teams } = require("./models");
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');
const connectEnsureLogin = require('connect-ensure-login');
const flash = require('express-flash');
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
// Set the view engine to EJS
app.set("view engine", "ejs");

// Set the views directory
app.set("views", path.join(__dirname, "views"));

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser("Something is there"));
app.use(flash());


// Passport middleware setup
app.use(session({
    secret: "my_secret_key1332141",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        
        const user = await Accounts.findOne({
            where: {
                email: username
            }
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
}));

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
//about page:
app.get("/", async (request, response)=>{
    // const user5 = await Events.findByPk(38);
    // console.log(user5);
    // await user5.destroy();

    return response.render("about");
})

// Signup Route
app.get("/signup", (request, response) => {
    return response.render("signup", { errors: [] });
});

app.post("/signup", async (request, response) => {
    try {
        const { firstName, lastName, email, password, isAdmin } = request.body;
        const errors = [];

        // Validate input fields
        if (!firstName || firstName.trim() === "") {
            errors.push({ message: "First Name is required." });
        }

        if (!email || email.trim() === "") {
            errors.push({ message: "Email is required." });
        }

        if (!password || password.trim() === "") {
            errors.push({ message: "Password is required." });
        }

        if (errors.length > 0) {
            // If there are validation errors, render the signup form with errors
            return response.render("signup", { errors });
        }

        // Check if an account with the same email already exists
        const existingAccount = await Accounts.findOne({ where: { email } });
        if (existingAccount) {
            errors.push({ message: "An account with this email already exists." });
            return response.render("signup", { errors });
        }

        // If no errors, proceed with creating the account
        const hashedPassword = await bcrypt.hash(password, 10);
        const account = await Accounts.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            isAdmin
        });

        console.log(account);
        return response.redirect("/home");
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Login route
app.get("/login", (request, response) => {
    // Render the login form with flash messages
    response.render("login", { errors: request.flash('error') });
});

app.post("/login", passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/login',
    failureFlash: true // This option is necessary for flash messages
}));

// Add this route to handle logout
app.post("/logout", (request, response) => {
    request.logout((err) => {
        if (err) {
            return response.status(500).json({ error: 'Logout failed' });
        }
        response.redirect("/login");
    });
});


// Home route
app.get("/home", connectEnsureLogin.ensureLoggedIn(),  async (request, response) => {
    try {
        // Fetch all events from the database
        await Events.destroy({
            where: {
                email: null,
            },
        });
        const eventsData = await Events.findAll();
        const account = await Accounts.findOne({
            where: {
                email: request.user.email
            }
        });
        // Render the home.ejs view with eventsData
        return response.render("home", { eventsData , user: request.user, username: account.firstName});
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Events route
app.get("/events", connectEnsureLogin.ensureLoggedIn(), (request, response) => {
    return response.render("events", { errors: [] });
});

app.post("/events", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const { eventName, maxSize, description, eventDate, eventTime } = request.body;
        const errors = [];
        if (!eventName || eventName.trim() === "" || !eventDate || !eventTime) {
            errors.push({ message: "Event Name or Event Date  or TIme is missing." });
        }
        if (!maxSize || maxSize < 1) {
            errors.push({ message: "Maximum Team Size should be at least 1." });
        }
        if (!description || description.trim() === "") {
            errors.push({ message: "Description is required." });
        }
        const existingEvent = await Events.findOne({
            where: Sequelize.where(
                Sequelize.fn('lower', Sequelize.col('eventName')),
                Sequelize.fn('lower', eventName.trim())
            )
        });
        
        if (existingEvent) {
            errors.push({ message: "Event Name is already exists" });
        }
        if (errors.length > 0) {
            // If there are validation errors, render the form with errors
            return response.render("events", { errors });
        }
        // Retrieve the email of the logged-in user from request.user
        const email = request.user.email;
        console.log(eventDate);
        const name = eventName.trim();
        const event = await Events.create({
            email,
            eventName: name,
            maxSize,
            description,
            date:eventDate,
            eventTime
        });
                console.log(event);
                return response.redirect("/profile");
            } catch (error) {
                console.log("Profile error");
                console.error(error);
                return response.status(500).json({ error: 'Internal Server Error' });
            }
});


// Join route
app.get("/join",  connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const eventId = request.query.id;
        // Users.destroy({
        //     where: {
        //         eventId: null
        //     }
        // })
        // .then((deletedRows) => {
        //     console.log(`${deletedRows} rows deleted.`);
        // })
        // .catch((error) => {
        //     console.error(error);
        // });
        // Fetch event details using the eventId
        const eventData = await Events.findByPk(eventId);
        console.log(eventData);
        // Check if eventData is null
        if (!eventData) {
            // Render an error page or redirect to the home page
            return response.status(404).render("join", {errors: ["Event Not Found"]} );
        }
        // Render the join.ejs view with event details
        return response.render("join", { eventData, errors: [] });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/join", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const eventId = request.query.id;
        console.log(eventId);

        // Fetch event details using the eventId
        const eventData = await Events.findByPk(eventId);

        // Perform validation
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

        // Check if a user with the same email and eventId already exists
        const existingUser = await Users.findOne({
            where: {
                eventId,
                email,
            }
        });

        if (existingUser) {
            errors.push({ message: "User with the same email already exists." });
            return response.render("join", { eventData, errors });
        }

        if (errors.length > 0) {
            // If there are validation errors, render the form with errors
            return response.render("join", { eventData, errors });
        }

        // If no errors, proceed with adding the user to the database
        // (Assuming you have a Users model for storing user information)
        const user = await Users.create({
            eventId,
            name,
            email,
            phone,
        });
        console.log("User Value: ", user);
        return response.redirect("/home");
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get("/joinAsTeam", async (request, response) => {
    try {
        const eventId = request.query.id;
        const eventData = await Events.findByPk(eventId);
        console.log(eventData);
        if (!eventData) {
            return response.status(404).render("joinAsTeam", { errors: ["Event Not Found"] });
        }
        
        return response.render("joinAsTeam", { eventData, errors: [], maxTeamSize: eventData.maxSize });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/submitTeam", async (request, response) => {
    try {
      let errors = [];
      const { teamName, eventId, memberNames, memberEmails, memberPhones } = request.body;
      const eventData = await Events.findByPk(eventId);
      // Check if any required field is missing or empty
      if (!teamName || teamName.trim() === '') {
        errors.push({ message: 'Team Name is required' });
      }
      if (!eventId) {
        errors.push({ message: 'Event ID is required' });
      }
      if (!memberNames || !Array.isArray(memberNames) || memberNames.length === 0 || memberNames.every(name => !name || name.trim() === '')) {
        errors.push({ message: 'Member Name(s) cannot be empty' });
      }
      
      if (!memberEmails || !Array.isArray(memberEmails) || memberEmails.length === 0 || memberEmails.every(email => !email || email.trim() === '')) {
        errors.push({ message: 'Member Email(s) cannot be empty' });
      }
      
      if (!memberPhones || !Array.isArray(memberPhones) || memberPhones.length === 0 || memberPhones.every(phone => !phone || phone.trim() === '')) {
        errors.push({ message: 'Member Phone(s) cannot be empty' });
      }
      
      
      // Check if the team name already exists
      const lowerCaseTeamName = teamName.toLowerCase();
      const teamExists = await Teams.findOne({ where:Sequelize.where(Sequelize.fn('lower', Sequelize.col('name')), lowerCaseTeamName) });
      if (teamExists) {
        errors.push({ message: 'Team Name already exists' });
      }
  
      // Check if any user with the same email and eventId already exists
      const userExists = await Teams.findOne({
        where: {
          eventId,
          memberEmails: {
            [Op.overlap]: memberEmails  // Use Op.overlap for array comparison
          }
        }
      });
      if (userExists) {
        errors.push({ message: 'User with the same email already exists for this event' });
      }
      
      // If there are any errors, render the joinAsTeam view with the errors
      if (errors.length > 0) {
        return response.render("joinAsTeam", { eventData, errors, maxTeamSize: eventData.maxSize });
      }
      
      // Create a new team if no errors were found
      const newTeam = await Teams.create({
        name: teamName,
        eventId,
        memberNames,
        memberEmails,
        memberPhones
      });
      console.log(newTeam);
      response.redirect("/home");
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  

  app.get("/profile", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const loggedInUserEmail = request.user.email;
        
        // Find all events created by the logged-in user
        const userCreatedEvents = await Events.findAll({
            where: {
                email: loggedInUserEmail,
            },
            include: [
                {
                    model: Users,
                    as: 'users', // Assuming the association between Events and Users is defined as 'users'
                },
                {
                    model: Teams,
                    as: 'teams', // Assuming the association between Events and Teams is defined as 'teams'
                }
            ],
        });
        
        // Find all events in which the user is enrolled
        const userJoinedEvents = await Users.findAll({
            where: {
                email: loggedInUserEmail,
            },
            include: [
                {
                    model: Events,
                    as: 'event', // Assuming the association between Users and Events is defined as 'event'
                },
            ],
        });
        const userJoinedTeams = await Teams.findAll({
            where: {
                memberEmails: {
                    [Op.contains] : [loggedInUserEmail]
                },
            },
            include: [
                {
                    model: Events,
                    as: 'event', // Assuming the association between Users and Events is defined as 'event'
                },
            ],
        });
        return response.render("profile", { userCreatedEvents, userJoinedEvents, userJoinedTeams, email: request.user.email});
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/removeEMail/:email/:teamId", async (request, response) => {
    try {
        const email = request.params.email;
        const teamId = request.params.teamId;

        const team = await Teams.findByPk(teamId);

        if (!team) {
            return response.status(404).json({ error: "Team not found" });
        }

        const memberIndex = team.memberEmails.indexOf(email);
        if (memberIndex === -1) {
            return response.status(404).json({ error: "Email not found in team members" });
        }

        team.memberEmails.splice(memberIndex, 1);

        if (team.memberEmails.length < 2) {
            await team.destroy();
        } else {
            await team.save();
        }

        return response.redirect('/profile');
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/removeUser/:userId', async (req, res) => {
    try{
        const userId= req.params.userId;
        const k = await Users.findOne({
            where: {
                id: userId
            }
        })
        console.log(k);
        await k.destroy();
        res.redirect("/profile");
    }catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/removeTeam/:teamId', async (req, res) => {
    try{
        const teamId= req.params.teamId;
        const k = await Teams.findOne({
            where: {
                id: teamId
            }
        })
        console.log(k);
        await k.destroy();
        res.redirect("/profile");
    }catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/removeEvent/:eventId', async (req, res) => {
    try{
        
        const eventId= req.params.eventId;
        console.log(eventId);
        const l = await Users.findOne({
            where: {
                eventId: eventId
            }
        })
        if(l) await l.destroy();
        const m = await Teams.findOne({
            where: {
                eventId: eventId
            }
        })
        if(m) await m.destroy();

        const k = await Events.findOne({
            where: {
                id: eventId
            }
        })
        console.log(k);
        await k.destroy();
        res.redirect("/profile");
    }catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});
// Start the server
app.listen(3000, () => {
    console.log("Your app is running on port 3000! ");
});
