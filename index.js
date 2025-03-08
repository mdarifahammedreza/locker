const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const uri = `mongodb+srv://reza1:${process.env.PASS}@reza.lrvbq.mongodb.net/reza1?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db;

// Middleware
app.use(cors({ origin: "*" })); // Allow all domains
app.use(express.json());

// Store active SSE connections
const clients = new Set();

// Function to connect to MongoDB
async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db("reza1");
    console.log("Connected to MongoDB");
    return db;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
}

// Function to broadcast logs to all connected clients
function broadcastLog(logMessage) {
  for (const client of clients) {
    client.write(`data: ${JSON.stringify(logMessage)}\n\n`);
  }
}

// Start the server only after the database connection is established
async function startServer() {
  try {
    // Wait for the database connection
    await connectToDatabase();

    // Routes
    app.get("/", (req, res) => {
      res.status(200).json({ status: "success", message: "Server is running" });
    });

    // Real-Time Logs Endpoint (SSE)
    app.get("/api/logs", (req, res) => {
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
    
      // Send a heartbeat every 10 seconds
      const heartbeatInterval = setInterval(() => {
        res.write(":\n\n"); // SSE heartbeat
      }, 1000);
    
      // Send initial log message
      res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), message: "Connected to logs" })}\n\n`);
    
      // Add this client to the set
      clients.add(res);
    
      // Clean up on client disconnect
      req.on("close", () => {
        clearInterval(heartbeatInterval);
        clients.delete(res);
        res.end();
      });
    });

    // Register Student
    app.post("/api/student/register", async (req, res) => {
      try {
        const { rfId, studentId, studentName } = req.body;
        if (!rfId || !studentId || !studentName)
          return res.status(400).send({ message: "All fields required" });

        const newStudent = {
          rfId,
          studentId,
          studentName,
          keyStatus: "Available",
          registerDate: new Date().toISOString(),
          takenKeyNumber: null,
        };

        const collection = db.collection("Student_info");
        const exists = await collection.findOne({ rfId });
        if (exists)
          return res
            .status(400)
            .send({ message: "Student already registered" });

        await collection.insertOne(newStudent);

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Student ${studentId} registered successfully`,
        });

        res.status(201).send({ message: "Student registered successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Delete Student
    app.delete("/api/student/delete/:studentid", async (req, res) => {
      try {
        const { studentid } = req.params;
        const collection = db.collection("Student_info");

        const result = await collection.deleteOne({ studentId: studentid });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Student not found" });
        }

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Student ${studentid} deleted successfully`,
        });

        res.status(200).send({ message: "Student deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Update Student Info
    app.put("/api/student/update/:studentid", async (req, res) => {
      try {
        const { studentid } = req.params;
        const {
          studentId,
          studentName,
          rfId,
          keyStatus,
          studentWarningStatus,
          studentBannedStatus,
        } = req.body;

        if (!studentId || !studentName || !rfId) {
          return res.status(400).send({ message: "All fields required" });
        }

        const updatedStudent = {
          studentId,
          studentName,
          rfId,
          keyStatus: keyStatus || "Available",
          studentWarningStatus: studentWarningStatus || "No",
          studentBannedStatus: studentBannedStatus || "No",
          registerDate: new Date().toISOString(),
        };

        const collection = db.collection("Student_info");
        const result = await collection.updateOne(
          { studentId: studentid },
          { $set: updatedStudent }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Student not found" });
        }

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Student ${studentid} updated successfully`,
        });

        res.status(200).send({ message: "Student updated successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Book a Key
    app.post("/api/key/request", async (req, res) => {
      try {
        const { rfid } = req.body;

        if (!rfid) {
          return res.status(400).send({ message: "RFID is required" });
        }

        const studentCollection = db.collection("Student_info");
        const keyCollection = db.collection("Key_Stack");

        const student = await studentCollection.findOne({ rfId: rfid });
        if (!student) {
          return res.status(404).send({ message: "Student not found" });
        }
        if (student.keyStatus === "Taken") {
          return res.status(400).send({ message: "Student already has a key" });
        }

        const key = await keyCollection.findOneAndUpdate(
          { status: "available" },
          { $set: { status: "assigned", assignedTo: student.studentId } },
          { returnDocument: "after" }
        );

        if (!key.value) {
          return res.status(404).send({ message: "No available keys" });
        }

        await studentCollection.updateOne(
          { rfId: rfid },
          {
            $set: {
              keyStatus: "Taken",
              takenKeyNumber: key.value.keyId,
              registerDate: new Date(),
            },
          }
        );

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Key ${key.value.keyId} assigned to student ${student.studentId}`,
        });

        res
          .status(200)
          .send({ message: "Key assigned successfully", keyId: key.value.keyId });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Add Key Info
    app.post("/api/key/add", async (req, res) => {
      try {
        const { keyId } = req.body;
        if (!keyId) {
          return res.status(400).send({ message: "Key ID is required" });
        }

        const normalizedKeyId = keyId.toLowerCase();
        const collection = db.collection("Key_Stack");

        const existingKey = await collection.findOne({
          keyId: { $regex: new RegExp(`^${normalizedKeyId}$`, "i") },
        });
        if (existingKey) {
          return res.status(400).send({ message: "Key already exists" });
        }

        await collection.insertOne({
          keyId: normalizedKeyId,
          assignedTo: null,
          status: "available",
        });

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Key ${normalizedKeyId} added successfully`,
        });

        res.status(201).send({ message: "Key added successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Update Key
    app.put("/api/key/update/:keyId", async (req, res) => {
      try {
        const { keyId } = req.params;
        const { status, assignedTo } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        updateData.assignedTo = assignedTo || "Not assigned";

        if (!status && !assignedTo) {
          return res
            .status(400)
            .send({ message: "Status or Assigned To is required" });
        }

        const collection = db.collection("Key_Stack");
        const existingKey = await collection.findOne({ keyId });
        if (!existingKey) {
          return res.status(404).send({ message: "Key not found" });
        }

        await collection.updateOne({ keyId }, { $set: updateData });

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Key ${keyId} updated successfully`,
        });

        res.status(200).send({ message: "Key updated successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Fetch All Keys
    app.get("/api/key/all", async (req, res) => {
      try {
        const collection = db.collection("Key_Stack");
        const keys = await collection.find({}).toArray();

        if (keys.length === 0) {
          return res.status(200).send({ message: "No keys found" });
        }

        res.status(200).send(keys);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Delete Key
    app.delete("/api/key/delete/:keyId", async (req, res) => {
      try {
        const { keyId } = req.params;
        const collection = db.collection("Key_Stack");

        const existingKey = await collection.findOne({ keyId });
        if (!existingKey) {
          return res.status(404).send({ message: "Key not found" });
        }

        const result = await collection.deleteOne({ keyId });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Key not found" });
        }

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Key ${keyId} deleted successfully`,
        });

        res.status(200).send({ message: "Key deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Find Student Info
    app.get("/api/student/info/:studentId", async (req, res) => {
      try {
        const { studentId } = req.params;
        if (!studentId) {
          return res.status(400).send({ message: "Student ID is required" });
        }

        const collection = db.collection("Student_info");
        const student = await collection.findOne({ studentId });

        if (!student) {
          return res.status(404).send({ message: "Student not found" });
        }

        res.status(200).send(student);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Return Key
    app.post("/api/key/return", async (req, res) => {
      try {
        const { rfid, keyNumber } = req.body;

        if (!rfid && !keyNumber) {
          return res
            .status(400)
            .send({ message: "RFID or Key Number is required" });
        }

        const studentCollection = db.collection("Student_info");
        const keyCollection = db.collection("Key_Stack");

        let student;

        if (rfid) {
          student = await studentCollection.findOne({ rfId: rfid });
        } else if (keyNumber) {
          student = await studentCollection.findOne({
            takenKeyNumber: keyNumber,
          });
        }

        if (!student || !student.takenKeyNumber) {
          return res
            .status(404)
            .send({ message: "Student not found or key not assigned" });
        }

        const keyId = keyNumber || student.takenKeyNumber;

        const keyUpdateResult = await keyCollection.updateOne(
          { keyId: keyId, status: "assigned" },
          {
            $set: {
              status: "available",
              assignedTo: null,
              returnDate: new Date(),
            },
          }
        );

        if (keyUpdateResult.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Key not found or already returned" });
        }

        await studentCollection.updateOne(
          { rfId: student.rfId },
          {
            $set: {
              keyStatus: "Available",
              takenKeyNumber: null,
            },
          }
        );

        // Broadcast log
        broadcastLog({
          timestamp: new Date().toISOString(),
          message: `Key ${keyId} returned by student ${student.studentId}`,
        });

        res.status(200).send({ message: "Key returned successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // Get Student Info
    app.get("/api/student/stack", async (req, res) => {
      try {
        const students = await db
          .collection("Student_info")
          .find({})
          .sort({ _id: -1 })
          .toArray();

        if (students.length === 0) {
          return res.status(200).send({ message: "No students found", data: [] });
        }

        res.status(200).send({ message: "Students retrieved successfully", data: students });
      } catch (error) {
        res.status(500).send({ message: "Error retrieving student stack.", error: error.message });
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server and database connection
startServer();