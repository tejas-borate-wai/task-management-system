const db = require("./db");
const express = require("express");
const multer = require("multer");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");

app.set("views engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload()); // Enable file upload

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);

  const formattedDate = date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");

  const formattedTime = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formattedDate} ${formattedTime}`;
};

// Home Route
app.get("/", (req, res) => {
  const taskQuery = `
    SELECT tasks.*, owners.owner_image, owners.id AS owner_id, owners.owner_name
    FROM tasks 
    JOIN owners ON tasks.task_owner_name = owners.owner_name
  `;

  const countQuery = `
    SELECT 
      (SELECT COUNT(*) FROM tasks) AS totalTasks,
      (SELECT COUNT(*) FROM tasks WHERE task_status = 'Open') AS openTasks,
      (SELECT COUNT(*) FROM tasks WHERE task_status = 'Completed') AS completedTasks
  `;

  db.query(taskQuery, (err, taskResults) => {
    if (err) {
      console.error("Database fetch error:", err);
      return res.status(500).send("Database error");
    }

    db.query(countQuery, (err, countResults) => {
      if (err) {
        console.error("Database fetch error:", err);
        return res.status(500).send("Database error");
      }

      // Format the dates
      taskResults.forEach((task) => {
        task.task_start_date = formatDate(task.task_start_date);
        task.task_due_date = formatDate(task.task_due_date);
      });

      res.render("index.ejs", {
        tasks: taskResults,
        totalTasks: countResults[0].totalTasks,
        openTasks: countResults[0].openTasks,
        completedTasks: countResults[0].completedTasks,
      });
    });
  });
});

// Add Task Page
app.get("/add_task", (req, res) => {
  const sql = "SELECT owner_name FROM owners";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(`Database fetch error: ${err}`);
      return res.status(500).send("Database error");
    }
    res.render("add_task.ejs", { owners: results });
  });
});

// Add Owner Page
app.get("/add_owner", (req, res) => {
  const sql = "SELECT * FROM owners";
  db.query(sql, (err, results) => {
    if (err) {
      console.log(`Database fetch error: ${err}`);
      return res.status(500).send("Database error");
    }
    res.render("add_owner.ejs", { owners: results });
  });
});

// Add Task to Database
app.post("/task_added", (req, res) => {
  const {
    task_owner_name,
    task_task_name,
    task_description,
    task_start_date,
    task_due_date,
    task_reminder,
    task_priority,
    task_status,
  } = req.body;

  const sqlInsert = `
    INSERT INTO tasks 
    (task_owner_name, task_task_name, task_description, task_start_date, 
    task_due_date, task_reminder, task_priority, task_status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    task_owner_name,
    task_task_name,
    task_description,
    task_start_date,
    task_due_date,
    task_reminder,
    task_priority,
    task_status,
  ];

  db.query(sqlInsert, values, (err, result) => {
    if (err) {
      console.error("Task Insertion Error:", err);
      return res.status(500).send("Error adding task");
    }
    console.log("Task Added:", result);
    res.redirect("/");
  });
});

// Add Owner to Database
app.post("/owner_added", (req, res) => {
  if (!req.files || !req.files.owner_image) {
    return res.status(400).send("No file uploaded.");
  }

  let ownerImage = req.files.owner_image;
  let uploadPath = path.join(__dirname, "public/uploads/", ownerImage.name);

  ownerImage.mv(uploadPath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    const { owner_name } = req.body;
    const imagePath = ownerImage.name;

    const sql = `INSERT INTO owners (owner_name, owner_image) VALUES (?, ?)`;
    db.query(sql, [owner_name, imagePath], (err, result) => {
      if (err) {
        console.log(`Error inserting owner: ${err}`);
        return res.status(500).send("Database error");
      }
      console.log("Owner Added");
      res.redirect("/add_owner");
    });
  });
});

// Delete Owner
app.get("/delete_owner/:id", (req, res) => {
  const ownerId = req.params.id;
  const sql = "DELETE FROM owners WHERE id = ?";

  db.query(sql, [ownerId], (err, result) => {
    if (err) {
      console.log(`Error deleting owner: ${err}`);
      return res.status(500).send("Database error");
    }
    res.redirect("/add_owner");
  });
});

// Task Details Page
app.get("/task_details/:id", (req, res) => {
  const taskId = req.params.id;
  const sql = `
    SELECT tasks.*, owners.owner_image, owners.id AS owner_id, owners.owner_name
    FROM tasks 
    JOIN owners ON tasks.task_owner_name = owners.owner_name
    WHERE tasks.task_id = ?`;

  db.query(sql, [taskId], (err, results) => {
    if (err) {
      console.error(`Database fetch error: ${err}`);
      return res.status(500).send("Database error");
    }

    if (results.length === 0) {
      return res.status(404).send("Task not found");
    }

    let task = results[0];
    task.task_start_date = formatDate(task.task_start_date);
    task.task_due_date = formatDate(task.task_due_date);

    res.render("task_details.ejs", { task, formatDateTime });
  });
});

// Delete Task
app.get("/delete_task/:id", (req, res) => {
  const taskId = req.params.id;
  const sql = "DELETE FROM tasks WHERE task_id = ?";

  db.query(sql, [taskId], (err, result) => {
    if (err) {
      console.error(`Database delete error: ${err}`);
      return res.status(500).send("Database error");
    }
    console.log(`Task ${taskId} deleted successfully`);
    res.redirect("/");
  });
});

// Edit Task Page
app.get("/edit_task_details/:id", (req, res) => {
  const taskId = req.params.id;
  const sql = `
    SELECT tasks.*, owners.owner_image, owners.id AS owner_id, owners.owner_name
    FROM tasks 
    JOIN owners ON tasks.task_owner_name = owners.owner_name
    WHERE tasks.task_id = ?`;

  db.query(sql, [taskId], (err, results) => {
    if (err) {
      console.error(`Database fetch error: ${err}`);
      return res.status(500).send("Database error");
    }

    if (results.length === 0) {
      return res.status(404).send("Task not found");
    }

    res.render("edit_details.ejs", { task: results[0] });
  });
});

// Update Task Details
app.post("/edited_task_details/:id", (req, res) => {
  const taskId = req.params.id;
  const sql = `
    UPDATE tasks SET 
      task_task_name = ?, task_description = ?, task_due_date = ?, 
      task_reminder = ?, task_priority = ?, task_status = ? 
    WHERE task_id = ?`;

  const values = [
    req.body.task_task_name,
    req.body.task_description,
    req.body.task_due_date,
    req.body.task_reminder,
    req.body.task_priority,
    req.body.task_status,
    taskId,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(`Database update error: ${err}`);
      return res.status(500).send("Database error");
    }
    res.redirect(`/task_details/${taskId}`);
  });
});

app.get("/form-view", (req, res) => {
  const sql = `
    SELECT * FROM tasks;
    SELECT COUNT(*) AS totalTasks FROM tasks;
    SELECT COUNT(*) AS openTasks FROM tasks WHERE task_status = 'Open';
    SELECT COUNT(*) AS completedTasks FROM tasks WHERE task_status = 'Completed';
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database fetch error:", err);
      return res.status(500).send("Database error");
    }

    // results[0] -> Tasks data
    // results[1] -> Total tasks count
    // results[2] -> Open tasks count
    // results[3] -> Completed tasks count

    res.render("form_view.ejs", {
      tasks: results[0],
      totalTasks: results[1][0].totalTasks,
      openTasks: results[2][0].openTasks,
      completedTasks: results[3][0].completedTasks,
      formatDate,
    });
  });
});

// Start the Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on ${port}`);
});
