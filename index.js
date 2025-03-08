const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const uri = `mongodb+srv://reza1:${process.env.PASS}@reza.lrvbq.mongodb.net/reza1?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db;

// Middleware
app.use(cors({ origin: '*' })); // Allow all origins
app.use(express.json());

// Function to connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db('reza1');
        console.log("Connected to MongoDB");
        return db; // Return the database connection
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error; // Throw the error to handle it in the main flow
    }
}

// Start the server only after the database connection is established
async function startServer() {
    try {
        // Wait for the database connection
        await connectToDatabase();

        // Routes
        app.get('/', (req, res) => {
            res.status(200).json({ status: "success", message: "Server is running" });
        });

        // Register Student
        app.post('/api/student/register', async (req, res) => {
            try {
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
            } catch (error) {
                res.status(500).send({ message: "Server error", error: error.message });
            }
        });
        //delete student
        app.delete('/api/student/delete/:studentid', async (req, res) => {
            try {
                const { studentid } = req.params; // Get studentId from request parameters
                const collection = db.collection("Student_info");
        
                // Delete the student by studentId
                const result = await collection.deleteOne({ studentId: studentid });
        
                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Student not found" });
                }
        
                res.status(200).send({ message: "Student deleted successfully" });
            } catch (error) {
                res.status(500).send({ message: "Server error", error: error.message });
            }
        });
        
        // Update Student Info
        app.put('/api/student/update/:studentid', async (req, res) => {
            try {
                const { studentid } = req.params; // Get studentId from request parameters
                const { studentId, studentName, rfId, keyStatus, studentWarningStatus, studentBannedStatus } = req.body;
        
                if (!studentId || !studentName || !rfId) {
                    return res.status(400).send({ message: "All fields required" });
                }
        
                const updatedStudent = {
                    studentId,
                    studentName,
                    rfId,
                    keyStatus: keyStatus || "Available", // Default to Available if no keyStatus provided
                    studentWarningStatus: studentWarningStatus || "No", // Default to "No"
                    studentBannedStatus: studentBannedStatus || "No", // Default to "No"
                    registerDate: new Date().toISOString() // Keep the register date same for updates (or update as needed)
                };
        
                const collection = db.collection("Student_info");
                const result = await collection.updateOne({ studentId: studentid }, { $set: updatedStudent });
        
                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "Student not found" });
                }
        
                res.status(200).send({ message: "Student updated successfully" });
            } catch (error) {
                res.status(500).send({ message: "Server error", error: error.message });
            }
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
                if (student.keyStatus === "Taken") {
                    return res.status(400).send({ message: "Student already has a key" });
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

        // Add Key Info
        app.post('/api/key/add', async (req, res) => {
            try {
                const { keyId } = req.body;
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
//fetch all keys
app.get('/api/key/all', async (req, res) => {
    try {
        const collection = db.collection("Key_Stack");

        // Fetch all keys
        const keys = await collection.find({}).toArray();

        if (keys.length === 0) {
            return res.status(200).send({ message: "No keys found" });
        }

        res.status(200).send(keys);
    } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
    }
});

        // Find Student Info
        app.get('/api/student/info/:studentId', async (req, res) => {
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

        // Get Student Info
        app.get('/api/student/stack', async (req, res) => {
            try {
                const students = await db.collection("Student_info").find({}).sort({ _id: -1 }).toArray();
                res.status(200).send(students);
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
        process.exit(1); // Exit the process if the database connection fails
    }
}

// Start the server and database connection
startServer();