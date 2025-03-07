const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = 3000;
const uri = `mongodb+srv://reza1:${process.env.PASS}@reza.lrvbq.mongodb.net/reza1?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db;

// Middleware
app.use(cors());
app.use(express.json());

(async () => {
    try {
        await client.connect();
        db = client.db('reza1');
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
    }
})();

const keyStack = [];
app.get('/', (req, res) => {
  res.status(200).json({ status: "success", message: "Server is running" });
});

// Register Student
app.post('/api/student/register', async (req, res) => {
    const { rfId, studentId, studentName } = req.body;
    if (!rfId || !studentId || !studentName) return res.status(400).send({ message: "All fields required" });

    const newStudent = {
        rfId, studentId, studentName,
        keyStatus: "Available",
        registerDate: new Date().toISOString(),
        takenKeyNumber: null
    };

    const collection = db.collection("Student_info");
    const exists = await collection.findOne({ rfId });
    if (exists) return res.status(400).send({ message: "Student already registered" });

    await collection.insertOne(newStudent);
    res.status(201).send({ message: "Student registered successfully" });
});

// Book a Key
app.post('/api/key/request', async (req, res) => {
  try {
      const { rfid } = req.body;

      if (!rfid) {
          return res.status(400).send({ message: "RFID is required" });
      }

      const studentCollection = db.collection("Student_info");
      const keyCollection = db.collection("Key_Stack");

      // Find student by RFID
      const student = await studentCollection.findOne({ rfId: rfid });
      if (!student) {
          return res.status(404).send({ message: "Student not found" });
      }

      // Find an available key
      const key = await keyCollection.findOne({ status: "available" });
      if (!key) {
          return res.status(404).send({ message: "No available keys" });
      }

      // Update the key to 'assigned'
      await keyCollection.updateOne(
          { keyId: key.keyId },
          { $set: { status: "assigned", assignedTo: student.studentId } }
      );

      // Update the student document to record the key they took
      await studentCollection.updateOne(
          { rfId: rfid },
          {
              $set: {
                  keyStatus: "Taken",
                  takenKeyNumber: key.keyId,
                  registerDate: new Date()
              }
          }
      );

      res.status(200).send({ message: "Key assigned successfully", keyId: key.keyId });
  } catch (error) {
      res.status(500).send({ message: "Server error", error: error.message });
  }
});


//add key info 
app.post('/api/key/add', async (req, res) => {
  try {
      const { keyId } = req.body;
      console.log("Key ID", keyId);
      if (!keyId) {
          return res.status(400).send({ message: "Key ID is required" });
      }

      const collection = db.collection("Key_Stack");

      // Check if key already exists
      const existingKey = await collection.findOne({ keyId });
      if (existingKey) {
          return res.status(400).send({ message: "Key already exists" });
      }

      // Add new key
      await collection.insertOne({ keyId, assignedTo: null, status: "available" });

      res.status(201).send({ message: "Key added successfully" });
  } catch (error) {
      res.status(500).send({ message: "Server error", error: error.message });
  }
});


// Find Student Info
app.get('/api/student/info/:studentId', async (req, res) => {
  console.log("Get Student", req.params);
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
});


// Return Key
app.post('/api/key/return', async (req, res) => {
  try {
    const { rfid, keyNumber } = req.body;

    // Check if at least one of RFID or Key Number is provided
    if (!rfid && !keyNumber) {
      return res.status(400).send({ message: "RFID or Key Number is required" });
    }

    const studentCollection = db.collection("Student_info");
    const keyCollection = db.collection("Key_Stack");

    let student;

    // Find student based on RFID or Key Number
    if (rfid) {
      student = await studentCollection.findOne({ rfId: rfid });
    } else if (keyNumber) {
      student = await studentCollection.findOne({ takenKeyNumber: keyNumber });
    }

    // If no student is found or no key assigned to the student
    if (!student || !student.takenKeyNumber) {
      return res.status(404).send({ message: "Student not found or key not assigned" });
    }

    // Get the key ID (either from keyNumber or student's takenKeyNumber)
    const keyId = keyNumber || student.takenKeyNumber;

    // Update the key status to 'available' and reset assignedTo field
    const keyUpdateResult = await keyCollection.updateOne(
      { keyId: keyId },
      { 
        $set: { 
          status: "available", 
          assignedTo: null, 
          takenBy: null, // Add any other fields that need to be reset
          returnDate: new Date() // Optional: Add return date or log of when it was returned
        }
      }
    );

    if (keyUpdateResult.modifiedCount === 0) {
      return res.status(404).send({ message: "Key not found or already returned" });
    }

    // Update the student document to mark the key as returned
    const studentUpdateResult = await studentCollection.updateOne(
      { rfId: student.rfId },
      {
        $set: {
          keyStatus: "Available",
          takenKeyNumber: null
        }
      }
    );

    if (studentUpdateResult.modifiedCount === 0) {
      return res.status(404).send({ message: "Failed to update student record" });
    }

    res.status(200).send({ message: "Key returned successfully" });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});



// Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));
function handleDbError(res, message) {
  console.error(message);
  res.status(500).send({ message });
}

// Get Student Info
app.get('/api/student/stack', async (req, res) => {
  try {
    const students = await db.collection("Student_info").find({}).sort({ _id: -1 }).toArray();
    res.status(200).send(students);
  } catch (error) {
    handleDbError(res, "Error retrieving student stack.");
  }
});