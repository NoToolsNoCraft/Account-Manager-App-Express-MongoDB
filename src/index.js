const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const session = require("express-session"); // Import express-session
const LogInCollection = require("./mongo");
const MongoStore = require("connect-mongo");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up express-session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET, 
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({
            mongoUrl: process.env.DATABASE_URL,
            collectionName: "sessions",
        }),
    })
);

const templatePath = path.join(__dirname, "../tempelates");
const publicPath = path.join(__dirname, "../public");

app.set("view engine", "hbs");
app.set("views", templatePath);
app.use(express.static(publicPath));

// Routes
app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/", (req, res) => {
    res.render("login");
});

// Signup Route
app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.name,
        password: req.body.password,
    };

    try {
        // Check if the username already exists in the database
        const existingUser = await LogInCollection.findOne({ name: req.body.name });

        // If the username is already taken, send a message
        if (existingUser) {
            res.send("Username already exists. Please choose a different username.");
        } else {
            // If the username is not taken, insert the new user into the database
            await LogInCollection.insertMany([data]);
            req.session.user = req.body.name; // Set user in session
            res.status(201).render("home", { naming: req.body.name });
        }
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).send("Server error");
    }
});


// Login Route
app.post("/login", async (req, res) => {
    try {
        const check = await LogInCollection.findOne({ name: req.body.name });

        if (check && check.password === req.body.password) {
            req.session.user = req.body.name; // Set user in session
            res.status(201).render("home", { naming: req.body.name });
        } else {
            res.send("Incorrect password");
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.send("Wrong details");
    }
});

app.get("/home", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/"); // Redirect to login if not logged in
    }

    res.render("home", { naming: req.session.user });
});

app.post("/change-password", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send(`<p>Unauthorized. Please log in.</p>
                                    <p><a href="/login">Go back to the login page</a></p>`);
    }

    const { oldPassword, newPassword } = req.body;

    try {
        const user = await LogInCollection.findOne({ name: req.session.user });

        // Verify the old password
        if (user && user.password === oldPassword) {
            // Update to the new password
            await LogInCollection.updateOne(
                { name: req.session.user },
                { $set: { password: newPassword } }
            );
            res.send(`<p>Password successfully changed.</p>
                      <p><a href="/home">Go back to the homepage</a></p>`);
        } else {
            res.status(400).send(`<p>Old password is incorrect.</p>
                                  <p><a href="/home">Go back to the homepage</a></p>`);
        }
    } catch (error) {
        console.error("Error during password change:", error);
        res.status(500).send(`<p>Server error.</p>
                              <p><a href="/home">Go back to the homepage</a></p>`);
    }
});


// Delete Account Route
app.post("/delete-account", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send(`<p>Unauthorized. Please log in.</p> 
                                    <p><a href="/">Go back to the login page</a></p>`);
    }

    try {
        const deletedUser = await LogInCollection.deleteOne({ name: req.session.user });

        if (deletedUser.deletedCount > 0) {
            req.session.destroy(); // Clear session after account deletion
            res.send(`<p>Your account has been successfully deleted.</p>
                    <p><a href="/login">Go back to the login page</a></p>`);
        } else {
            res.status(404).send("Account not found.");
        }
    } catch (error) {
        console.error("Error during account deletion:", error);
        res.status(500).send("Server error");
    }
});

// Logout Route
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Error logging out.");
        }
        res.redirect("/"); // Redirect to login page after logout
    });
});

app.get("/home", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/"); // Redirect to login if not logged in
    }

    res.render("home", { naming: req.session.user });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

