const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
var key;
const app = express();
const port = 3000;

const status = {
  Status_code: 400,
  Status: "Locker server running successfully",
  Author: "Md Arif Ahammed Reza",
  Contact: "reza35-951@diu.edu.bd"
};

// MongoDB connection
const uri = `mongodb+srv://reza1:${process.env.PASS}@reza.lrvbq.mongodb.net/?retryWrites=true&w=majority&appName=REZA`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
let db;

// Middleware
app.use(cors());
app.use(express.json());
// Connect to MongoDB
(async () => {
  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
    db = client.db('reza1');
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
})();

// Helper: Handle DB errors
const handleDbError = (res, errorMessage, statusCode = 500) => {
  console.error(errorMessage);
  res.status(statusCode).send({ message: errorMessage });
};

// Routes
app.get('/', (req, res) => res.send(status));


const insertIfNotExists = async (collectionName, query, newEntry) => {
  const collection = db.collection(collectionName);
  const existingEntry = await collection.findOne(query);
  if (existingEntry) {
    return { message: "Entry already exists.", success: false };
  }
  await collection.insertOne(newEntry);
  return { message: "Entry added successfully!", success: true };
};

// Add Key to Stack
app.post('/api/Locker/key', async (req, res) => {
  const { data } = req.body;
  console.log(data);
  const  Key_ID  = data;
  if (!Key_ID) return res.status(400).send({ message: "Key ID is required." });

  try {
    const collection = db.collection("Stack_of_Keys");
    const date = new Date();
    const newEntry = { Key_ID, date: date.toISOString(), time: date.toLocaleTimeString() };
    const result = await insertIfNotExists("Stack_of_Keys", { Key_ID }, newEntry);
    res.status(200).send(result);
  } catch (error) {
    handleDbError(res, "Error adding key to stack.");
  }
});
const message = "runinggggggg"
console.log(message);
// Book a Key
app.post('/api/student/booked-key', async (req, res) => {
  const { data: rfId, key: bookedKey } = req.body;
console.log(rfId,bookedKey)
  if (!rfId) return res.status(400).send({ message: "RFID is required." });

  try {
    const studentCollection = db.collection("Student_info");
    const stackCollection = db.collection("Stack_of_Keys");

    const student = await studentCollection.findOne({ rfId });
    if (!student) return res.status(404).send({ message: "Student not found!" });
    if (student.keyStatus === "Taken" && bookedKey===undefined) {
      return res.status(200).send({ message: "Key already taken!", code: "Camera activated" });
    }
    if (student.keyStatus === "Taken" && (bookedKey === student.TakenKeyNumber || bookedKey === key)) {
      await studentCollection.updateOne(
        { rfId },
        { $set: { keyStatus: "availble", lastKeyActivityTime: new Date().toISOString(), TakenKeyNumber: null } }
      );
      return res.status(200).send({ message: "Key submitted", code: "motor" });
    }

    const key = bookedKey || (await stackCollection.find({}).sort({ _id: -1 }).toArray())[0]?.Key_ID;
    if (!key) return res.status(404).send({ message: "No keys available." });

    await studentCollection.updateOne(
      { rfId },
      { $set: { keyStatus: "Taken", lastKeyActivityTime: new Date().toISOString(), TakenKeyNumber: key } }
    );

    await stackCollection.deleteOne({ Key_ID: key });

    res.status(200).send({ authorized: true});
  } catch (error) {
    handleDbError(res, "Error booking the key.");
  }
});

// Get Stack of Keys
app.get('/api/Locker/stack', async (req, res) => {
  try {
    const keys = await db.collection("Stack_of_Keys").find({}).sort({ _id: -1 }).toArray();
    res.status(200).send(keys);
  } catch (error) {
    handleDbError(res, "Error retrieving stack.");
  }
});

// Get Student Info
app.get('/api/student/stack', async (req, res) => {
  try {
    const students = await db.collection("Student_info").find({}).sort({ _id: -1 }).toArray();
    res.status(200).send(students);
  } catch (error) {
    handleDbError(res, "Error retrieving student stack.");
  }
});
//Qr Value Taken
app.post("/api/get-qr", (req, res) => {
  const { qrValue } = req.body;  // Now matches the sent key
  console.log("Received QR Value:", qrValue);
  key=qrValue;
  if (!qrValue) {
      return res.status(400).json({ error: "No QR value provided" });
  }
  console.log("QR Value processed:", qrValue);
  // Example: Log or process the value further
  res.json({ message: `QR Value processed: ${qrValue}` });
});

app.get('/api/get-qr', (req, res) => {res.send("Hello World"+key)});

// Register Student
app.post('/api/student/register', async (req, res) => {
  const { rfId, studentId, name } = req.body;

  if (!rfId || !studentId || !name) {
    return res.status(400).send({ message: "RFID, Student ID, and Name are required." });
  }

  const newStudent = {
    rfId,
    studentId,
    name,
    keyStatus: "Available",
    lastKeyActivityTime: new Date().toISOString(),
    studentBannedStatus: false,
    studentWarningStatus: 0,
    TakenKeyNumber: null
  };

  try {
    const result = await insertIfNotExists("Student_info", { rfId }, newStudent);
    res.status(201).send({ message: `Student ${name} registered successfully!`, success: result.success });
  } catch (error) {
    handleDbError(res, "Error registering student.");
  }
});

// Start Server
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
