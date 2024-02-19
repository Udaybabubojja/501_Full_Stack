// Import necessary modules
const express = require("express");
const app = express();
let cookieParser = require("cookie-parser");
const csrf = require("tiny-csrf");
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
const transporter = require("./mail.js");
// Set the view engine to EJS
app.set("view engine", "ejs");

// Set the views directory
app.set("views", path.join(__dirname, "views"));

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser("Something is there"));
app.use(csrf("abcdefghijklmnopqrstuvwxyz123456", ["PUT", "POST", "DELETE"]));
app.use(flash());

app.use('/public', express.static(path.join(__dirname, 'public')))

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
    return response.render("signup", { errors: [], csrfToken: request.csrfToken() });
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
        const existingAccount = await Accounts.findOne({ where: { email } });
        if (existingAccount) {
            errors.push({ message: "An account with this email already exists." });
            
        }
        if (errors.length > 0) {
            // If there are validation errors, render the signup form with errors
            return response.render("signup", { errors, csrfToken: request.csrfToken() });
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
        await transporter.sendMail({
            from: '"Events Organiser" <Event_organiser@outlook.com>',
            to: email,
            subject: 'Welcome to Events Organiser',
            html: `
                <p>Hello ${firstName},</p>
                <p>Welcome to Events Organiser!</p>
                <p>Your account has been successfully created.</p>
                <p>Thank you for joining us!</p>
            `
        });
        console.log(account);
        return response.redirect("/login");
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Login route
app.get("/login", async (request, response) => {
    // Render the login form with flash messages
    const a = await request.user;
    console.log(a);
    if(!a)
    response.render("login", { errors: request.flash('error'), csrfToken: request.csrfToken() });
    else response.redirect("/home");
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
        // Clear user session
        request.session.destroy((err) => {
            if (err) {
                return response.status(500).json({ error: 'Session destroy failed' });
            }
            // Redirect to login page
            response.redirect("/login");
        });
    });
});



// Home route
app.get("/home", connectEnsureLogin.ensureLoggedIn(),  async (request, response) => {
    try {
        // Fetch all events from the database
        if(!request.user) response.redirect("/login");
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
        return response.render("home", { eventsData , user: request.user, username: account.firstName, csrfToken: request.csrfToken()});
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Events route
app.get("/events", connectEnsureLogin.ensureLoggedIn(), (request, response) => {
    return response.render("events", { errors: [] , csrfToken: request.csrfToken()});
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
            return response.render("events", { errors,  csrfToken: request.csrfToken() });
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
        await transporter.sendMail({
            from: '"Events Organiser" <Event_organiser@outlook.com>',
            to: email,
            subject: 'Event Created Successfully',
            html: `
                <p>Hello,🎉</p>
                <p>Your event "${eventName.trim()}" has been successfully created.</p>
                <p>Details:</p>
                <ul>
                    <li>Event Name: ${eventName.trim()}</li>
                    <li>Maximum Team Size: ${maxSize}</li>
                    <li>Description: ${description}</li>
                    <li>Date: ${eventDate}</li>
                    <li>Time: ${eventTime}</li>
                </ul>
                <p>Thank you for using our platform! 🚀 </p>
            `,
        });
        console.log("Details of the Event: ", event);
        response.redirect("/profile");
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
            return response.status(404).render("join", {errors: ["Event Not Found"], csrfToken: request.csrfToken() } );
        }
        // Render the join.ejs view with event details
        return response.render("join", { eventData, errors: [], csrfToken: request.csrfToken() });
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
        }

        if (errors.length > 0) {
            // If there are validation errors, render the form with errors
            return response.render("join", { eventData, errors, csrfToken: request.csrfToken() });
        }

        // If no errors, proceed with adding the user to the database
        // (Assuming you have a Users model for storing user information)
        const user = await Users.create({
            eventId,
            name,
            email,
            phone,
        });
        
        // Send enrollment confirmation email to the user
        await transporter.sendMail({
            from: '"Event Organiser" <Event_organiser@outlook.com>',
            to: email,
            subject: 'Enrollment Confirmation for Event',
            html: `
                <p>Hello ${name},</p>
                <p>You have successfully enrolled in the event "${eventData.eventName}".</p>
                <p>Event Details:</p>
                <ul>
                    <li>Event Name: ${eventData.eventName}</li>
                    <li>Date: ${eventData.date}</li>
                    <li>Time: ${eventData.eventTime}</li>
                    <li>Description: ${eventData.description}</li>
                </ul>
                <p>Your provided information:</p>
                <ul>
                    <li>Name: ${name}</li>
                    <li>Email: ${email}</li>
                    <li>Phone Number: ${phone}</li>
                </ul>
                <p>Thank you for joining the event!</p>
            `,
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
            return response.status(404).render("joinAsTeam", { errors: ["Event Not Found"], csrfToken: request.csrfToken() });
        }
        
        return response.render("joinAsTeam", { eventData, errors: [], maxTeamSize: eventData.maxSize, csrfToken: request.csrfToken()});
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

        const lowerCaseTeamName = teamName.toLowerCase();
        const teamExists = await Teams.findOne({ where: eventId, name: Sequelize.where(Sequelize.fn('lower', Sequelize.col('name')), lowerCaseTeamName) });
        if (teamExists) {
            errors.push({ message: 'Team Name already exists' });
        }

        const userExists = await Teams.findOne({
            where: {
                eventId,
                memberEmails: {
                    [Op.overlap]: memberEmails
                }
            }
        });
        if (userExists) {
            errors.push({ message: 'User with the same email already exists for this event' });
        }
        const userEmailMatches = await Users.findOne({
            where: {
                eventId,
                email: memberEmails
            }
        });
        if (userEmailMatches) {
            errors.push({ message: 'User with the same email already exists for this event' });
        }

        if (errors.length > 0) {
            return response.render("joinAsTeam", { eventData, errors, maxTeamSize: eventData.maxSize, csrfToken: request.csrfToken() });
        }

        const newTeam = await Teams.create({
            name: teamName,
            eventId,
            memberNames,
            memberEmails,
            memberPhones
        });

        // Send email notification to each member
        for (const email of memberEmails) {
            await transporter.sendMail({
                from: '"Events Organiser" <Event_organiser@outlook.com>',
                to: email,
                subject: 'Team Enrollment Confirmation',
                html: `
                    <p>Hello,</p>
                    <p>You have been successfully enrolled in the team "${teamName}" for the event "${eventData.eventName}".</p>
                    <p>Team Details:</p>
                    <ul>
                        <li>Team Name: ${teamName}</li>
                        <li>Event Name: ${eventData.eventName}</li>
                        <li>Date: ${eventData.date}</li>
                        <li>Time: ${eventData.eventTime}</li>
                    </ul>
                    <p>Thank you for participating!</p>
                `
            });
        }

        console.log(newTeam);
        response.redirect("/home");
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
});

  
app.get("/profile", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        if (!request.isAuthenticated()) {
            return response.redirect("/login");
        }
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
        return response.render("profile", { userCreatedEvents, userJoinedEvents, userJoinedTeams, email: request.user.email, csrfToken: request.csrfToken() });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/removeEmail/:email/:teamId", connectEnsureLogin.ensureLoggedIn(), async (request, response) => {
    try {
        const removedEmail = request.params.email;
        const teamId = request.params.teamId;

        const team = await Teams.findByPk(teamId);

        if (!team) {
            return response.status(404).json({ error: "Team not found" });
        }

        const memberIndex = team.memberEmails.indexOf(removedEmail);
        if (memberIndex === -1) {
            return response.status(404).json({ error: "Email not found in team members" });
        }

        // Remove the email from the team members' list
        team.memberEmails.splice(memberIndex, 1);

        // Check if the team has less than 2 members after removal
        if (team.memberEmails.length < 2) {
            // If less than 2 members, delete the team
            await team.destroy();
        } else {
            // If still 2 or more members, save the team with the updated member list
            await team.save();
        }

        // Send email notification to remaining team members
        const remainingMembers = team.memberEmails;
        for (const email of remainingMembers) {
            await transporter.sendMail({
                from: '"Events Organiser" <Event_organiser@outlook.com>',
                to: email,
                subject: 'Team Member Exit',
                html: `
                    <p>Hello,</p>
                    <p>${removedEmail} has exited from the team "${team.name}".</p>
                    <p>Team Details:</p>
                    <ul>
                        <li>Team Name: ${team.name}</li>
                        <li>Event Name: ${team.eventData.eventName}</li>
                        <li>Date: ${team.eventData.date}</li>
                        <li>Time: ${team.eventData.eventTime}</li>
                    </ul>
                    <p>Thank you.</p>
                `
            });
        }

        return response.redirect('/profile');
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/removeUser/:userId', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await Users.findByPk(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Store user details before deletion for email notification
        const userName = user.name;
        const userEmail = user.email;
        const eventId = user.eventId;
        const event = await Events.findByPk(eventId);

        await user.destroy();

        // Send email notification to the user
        await transporter.sendMail({
            from: '"Events Organiser" <Event_organiser@outlook.com>',
            to: userEmail,
            subject: 'Removed from Event',
            html: `
                <p>Hello ${userName},</p>
                <p>You have been removed from the event "${event.eventName}".</p>
                <p>Thank you.</p>
            `
        });

        res.redirect("/profile");
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/removeTeam/:teamId', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const team = await Teams.findByPk(teamId);

        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        // Store team details before deletion for email notification
        const teamName = team.name;
        const teamMembers = team.memberEmails;

        await team.destroy();

        // Send email notification to team members
        for (const email of teamMembers) {
            await transporter.sendMail({
                from: '"Events Organiser" <Event_organiser@outlook.com>',
                to: email,
                subject: 'Team Disbanded',
                html: `
                    <p>Hello,</p>
                    <p>The team "${teamName}" has been disbanded.</p>
                    <p>Thank you.</p>
                `
            });
        }

        res.redirect("/profile");
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/removeEvent/:eventId', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // Find the event and associated users
        const event = await Events.findByPk(eventId);
        const users = await Users.findAll({ where: { eventId } });

        // Find associated teams and team members
        const teams = await Teams.findAll({ where: { eventId } });
        const teamMembers = [];
        for (const team of teams) {
            teamMembers.push(...team.memberEmails);
        }

        // Collect all email addresses (event participants and team members)
        const allEmails = [];
        for (const user of users) {
            allEmails.push(user.email);
        }
        for (const memberEmail of teamMembers) {
            allEmails.push(memberEmail);
        }
        allEmails.push(event.email);
        // Send email notification to all event participants and team members
        for (const email of allEmails) {
            await transporter.sendMail({
                from: '"Events Organiser" <Event_organiser@outlook.com>',
                to: email,
                subject: 'Event Cancelled',
                html: `
                    <p>Hello,</p>
                    <p>The event <b>"${event.eventName}"</b> has been cancelled.</p>
                    <p>Thank you.</p>
                `
            });
        }

        // Delete associated users, teams, and the event
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
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
app.listen(3000, () => {
    console.log("Your app is running on port 3000! ");
});
