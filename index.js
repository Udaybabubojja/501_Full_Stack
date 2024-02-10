// Import necessary modules
const express = require("express");
const app = express();
let cookieParser = require("cookie-parser");
const path = require("path");
const bodyParser = require("body-parser");
const { Events, Users, Accounts } = require("./models");
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');
const connectEnsureLogin = require('connect-ensure-login');
const flash = require('express-flash');
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
    const useinfo = await Events.findByPk(15);
    const useinfo1 = await Events.findByPk(16);
    console.log(useinfo);
    console.log(useinfo1);
    await useinfo.destroy();
    await useinfo1.destroy();
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
        // Render the home.ejs view with eventsData
        return response.render("home", { eventsData });
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
        const { eventName, maxSize, description, email } = request.body;
        const errors = [];
        if (!eventName || eventName.trim() === "" || !email || email.trim() === "") {
            errors.push({ message: "Event Name or Email is Not exists." });
        }
        if (!maxSize || maxSize < 1) {
            errors.push({ message: "Maximum Team Size should be at least 1." });
        }
        if (!description || description.trim() === "") {
            errors.push({ message: "Description is required." });
        }

        if (errors.length > 0) {
            // If there are validation errors, render the form with errors
            return response.render("events", { errors });
        }

        // If no errors, proceed with adding the event to the database
        const event = await Events.create({
            email,
            eventName,
            maxSize,
            description,
        });
        console.log(event);
        return response.redirect("/home");
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Join route
app.get("/join",  connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const eventId = request.query.id;
        Users.destroy({
            where: {
                eventId: null
            }
        })
        .then((deletedRows) => {
            console.log(`${deletedRows} rows deleted.`);
        })
        .catch((error) => {
            console.error(error);
        });
        // Fetch event details using the eventId
        const eventData = await Events.findByPk(eventId);

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

// Profile route
app.get("/profile", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const loggedInUserEmail = request.user.email;

        // Find events created by the logged-in user
        const userCreatedEvents = await Events.findAll({
            where: {
                email: loggedInUserEmail,
            },
        });

        // Find events in which the logged-in user is enrolled
        const userEnrolledEvents = await Users.findAll({
            where: {
                email: loggedInUserEmail,
            },
            include: {
                model: Events,
                as: 'event',
            },
        });

        // Fetch all enrolled users (assuming there is a model for enrolled users)
        const allEnrolledUsers = await Users.findAll({
            include: {
                model: Events,
                as: 'event',
            },
        });

        return response.render("profile", { userCreatedEvents, userEnrolledEvents, allEnrolledUsers });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});


// Add this route to handle user removal
// Add this route to handle user removal
app.post("/removeUser/:eventId/:userId", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const eventId = request.params.eventId;
        const userId = request.params.userId;
        
        const user = await Users.findByPk(userId);
        // Remove the user from the Users table
        await user.destroy();
        // Redirect to the profile page with a success message
        return response.redirect("/profile");
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get("/joinAsTeam", (request, response) => {
    const maxTeamSize = request.query.id;
    console.log(maxTeamSize);
    return response.render("joinAsTeam", { errors: [] , maxTeamSize});
})

// Start the server
app.listen(3000, () => {
    console.log("Your app is running on port 3000! ");
});
